import { supabaseAdmin } from './_db.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, code, user_id } = req.body;
    if (!email || !code || !user_id) return res.status(400).json({ error: 'Missing fields' });

    const { data: userData, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user_id)
        .single();

    if (error || !userData) return res.status(404).json({ error: 'User not found' });

    if (userData.otp !== code) {
        return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (new Date() > new Date(userData.otp_expires_at)) {
        return res.status(400).json({ error: 'Verification code has expired' });
    }

    const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ subscribed: true, otp: null, otp_expires_at: null })
        .eq('id', user_id);

    if (updateError) return res.status(500).json({ error: updateError.message });

    return res.status(200).json({ success: true, message: 'Email verified successfully!' });
}
