require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP ERROR:', error);
    } else {
        console.log('✅ SMTP ready to send emails');
    }
});


app.post('/send-schedule-email', async (req, res) => {
    const { emails, examName, date, time, meetingUrl } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: 'Emails required' });
    }

    if (!examName || !date || !time || !meetingUrl) {
        return res.status(400).json({ error: 'Missing exam details' });
    }

    try {
        for (const email of emails) {
            await transporter.sendMail({
                from: `"CDAC Proctoring Portal" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: `📘 Exam Scheduled: ${examName}`,
                html: `
                    <h2>📢 Exam Scheduled</h2>
                    <p><b>Exam:</b> ${examName}</p>
                    <p><b>Date:</b> ${date}</p>
                    <p><b>Time:</b> ${time}</p>
                    <p>Please join the exam on time using the link below:</p>
                    <p>
                        <a href="${meetingUrl}" target="_blank">
                            👉 Join Exam
                        </a>
                    </p>
                    <br/>
                    <p><b>⚠️ Instructions:</b></p>
                    <ul>
                        <li>Join 10 minutes early</li>
                        <li>Camera & mic must be enabled</li>
                        <li>Late entry may be restricted</li>
                    </ul>
                    <br/>
                    <p>— CDAC Proctoring Portal</p>
                `
            });
        }

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Email error:', err);
        res.status(500).json({ error: 'Failed to send email' });
    }
});


app.listen(5000, () => {
    console.log('✅ Email server running on port 5000');
});
