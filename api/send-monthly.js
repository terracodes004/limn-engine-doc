import { supabaseAdmin } from './_db.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    try {
        const { data: subscribed, error: subError } = await supabaseAdmin
            .from('users')
            .select('id, subscribed')
            .eq('subscribed', true);

        if (subError) {
            return res.status(500).json({ error: 'users query: ' + subError.message });
        }

        if (!subscribed || subscribed.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No subscribed users',
                subscribed: 0,
                sent: 0
            });
        }

        const allAuthUsers = [];
        let page = 1;
        const perPage = 1000;

        while (true) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({
                page: page,
                perPage: perPage
            });

            if (error) {
                return res.status(500).json({ error: 'listUsers: ' + error.message });
            }

            allAuthUsers.push(...data.users);

            if (data.users.length < perPage) break;
            page++;
        }

        const emailById = {};
        for (const u of allAuthUsers) {
            if (u.email) emailById[u.id] = u.email;
        }

        const recipients = subscribed
            .map(s => ({ id: s.id, email: emailById[s.id] }))
            .filter(r => r.email);

        const subject = 'Limn Engine Monthly Digest';
        const htmlContent = '<p>🏆 Here are the top community creations and major feature updates for this month!</p>';

        await supabaseAdmin
            .from('engine_updates')
            .insert([{ title: subject, content: htmlContent }]);

        let successCount = 0;
        const failures = [];

        for (const r of recipients) {
            try {
                const result = await resend.emails.send({
                    from: 'Limn Engine <onboarding@resend.dev>',
                    to: r.email,
                    subject: subject,
                    html: htmlContent,
                });

                if (result.error) {
                    failures.push({ email: r.email, error: result.error.message });
                } else {
                    successCount++;
                }
            } catch (err) {
                failures.push({ email: r.email, error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            subscribed: subscribed.length,
            sent: successCount,
            failures: failures
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
