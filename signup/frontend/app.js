import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://pjtpesdhjfvcidfkxord.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdHBlc2RoamZ2Y2lkZmt4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDUyNDUsImV4cCI6MjEwMzcyMTI0NX0.110aDXEqJ4PxjKWNv1Z2YNR8frklg3WW1u0HePDoN38';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'sign_up', {
          method: 'email_or_oauth',
          user_id: session.user.id
        });
        console.log('✅ GA4 sign_up event sent for:', session.user.email);
      } else {
        console.warn('⚠️ gtag not found – GA4 script might not be loaded.');
      }
    }
  }
);

const messageEl = document.getElementById('message');

const homeRedirect = window.location.origin + '/index.html';
const callbackPath = window.location.origin + '/signup/frontend/callback.html';

const authButtons = document.getElementById('auth-buttons');
const userDropdown = document.getElementById('user-dropdown');
const dropdownToggle = document.getElementById('dropdown-toggle');
const dropdownMenu = document.getElementById('dropdown-menu');
const logoutBtn = document.getElementById('logout-btn');

if (dropdownToggle && dropdownMenu) {
    dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
    });

    window.addEventListener('click', () => {
        if (!dropdownMenu.classList.contains('hidden')) {
            dropdownMenu.classList.add('hidden');
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = homeRedirect;
    });
}

function showMessage(text, type = 'error') {
    if (messageEl) {
        messageEl.textContent = text;
        messageEl.className = type;
        messageEl.style.display = 'block';
    }
}

async function checkUserRouting() {
    let { data: { session }, error } = await supabase.auth.getSession();
    
    if (!session) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const retryResult = await supabase.auth.getSession();
        session = retryResult.data.session;
    }

    const userBanner = document.getElementById('user-banner');

    if (session) {
        const userEmail = session.user.email;

        let userAvatarUrl = 'img/logo.png';

        const { data: profile } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (profile && profile.avatar_url) {
            userAvatarUrl = profile.avatar_url;
            localStorage.setItem('limn_avatar', profile.avatar_url);
        }

        if (profile && profile.display_name) {
            localStorage.setItem('limn_username', profile.display_name);
        }

        if (authButtons) authButtons.style.display = 'none';
        if (userDropdown) userDropdown.style.display = 'block';

        const emailDisplay = document.getElementById('user-email-display');
        if (emailDisplay) emailDisplay.textContent = userEmail;

        const avatarImg = document.getElementById('user-avatar');
        if (avatarImg) avatarImg.src = userAvatarUrl;

        const stepGoogle = document.getElementById('step-google');
        const stepEmail = document.getElementById('step-email');
        if (stepGoogle) stepGoogle.classList.add('hidden');
        if (stepEmail) stepEmail.classList.remove('hidden');
    } else {
        if (userBanner) userBanner.style.display = 'none';
        if (authButtons) authButtons.style.display = 'block';
        if (userDropdown) userDropdown.style.display = 'none';

        const stepGoogle = document.getElementById('step-google');
        const stepEmail = document.getElementById('step-email');
        if (stepGoogle) stepGoogle.classList.remove('hidden');
        if (stepEmail) stepEmail.classList.add('hidden');
    }
}

checkUserRouting();

const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        showMessage('⏳ Connecting to Google...', 'success');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: callbackPath }
        });
        if (error) {
            showMessage('❌ OAuth Error: ' + error.message, 'error');
        }
    });
}

const sendEmailBtn = document.getElementById('send-email-btn');
if (sendEmailBtn) {
    sendEmailBtn.addEventListener('click', async () => {
        const emailInput = document.getElementById('email-input');
        const email = emailInput ? emailInput.value.trim() : '';
        if (!email) return showMessage('Enter a valid email address', 'error');

        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: { emailRedirectTo: callbackPath }
        });
        
        if (!error) {
            showMessage('✅ Verification code sent to your email!', 'success');
            const otpSection = document.getElementById('otp-section');
            if (otpSection) otpSection.classList.remove('hidden');
        } else {
            showMessage('❌ ' + error.message, 'error');
        }
    });
}

const verifyEmailBtn = document.getElementById('verify-email-btn');
if (verifyEmailBtn) {
    verifyEmailBtn.addEventListener('click', async () => {
        const emailInput = document.getElementById('email-input');
        const otpInput = document.getElementById('otp-input');
        const email = emailInput ? emailInput.value.trim() : '';
        const token = otpInput ? otpInput.value.trim() : '';

        if (!token) return showMessage('Enter the verification code', 'error');

        const { error } = await supabase.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });
        
        if (!error) {
            showMessage('🎉 Email verified! Redirecting...', 'success');
            setTimeout(() => { window.location.href = homeRedirect; }, 1500);
        } else {
            showMessage('❌ ' + error.message, 'error');
        }
    });
}
