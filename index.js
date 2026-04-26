const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'bus123',
    resave: false,
    saveUninitialized: false
}));

const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});

db.connect(err => {
    if (err) console.log('DB Error:', err);
    else console.log('MySQL Connected!');
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mac.home2305@gmail.com',
        pass: 'jueu uhgy gagw kevk'
    }
});

const otpStore = {};

app.get('/', (req, res) => res.render('home'));
app.get('/register', (req, res) => res.render('register'));
app.get('/login', (req, res) => res.render('login'));

app.get('/buses', (req, res) => {
    db.query('SELECT * FROM buses', (err, results) => {
        res.render('buses', { buses: results });
    });
});

app.post('/send-otp', (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[email] = otp;
    const mailOptions = {
        from: 'TERA_GMAIL@gmail.com',
        to: email,
        subject: 'BusBook OTP Verification',
        html: `<h2>Your OTP is: <strong>${otp}</strong></h2><p>Valid for 5 minutes.</p>`
    };
    transporter.sendMail(mailOptions, (err) => {
        if (err) res.json({ success: false });
        else res.json({ success: true });
    });
});

app.post('/register', async (req, res) => {
    const { name, email, password, phone, otp } = req.body;
    if (parseInt(otp) !== otpStore[email]) {
        return res.send('Invalid OTP! Go back and try again.');
    }
    const hash = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (name, email, password, phone) VALUES (?,?,?,?)',
        [name, email, hash, phone], (err) => {
            if (err) res.send('Email already exists!');
            else res.redirect('/login');
        });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email=?', [email], async (err, results) => {
        if (results.length > 0) {
            const match = await bcrypt.compare(password, results[0].password);
            if (match) {
                req.session.user = results[0];
                res.redirect('/dashboard');
            } else res.send('Wrong password!');
        } else res.send('User not found!');
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    db.query('SELECT b.*, bu.bus_name, bu.from_city, bu.to_city FROM bookings b JOIN buses bu ON b.bus_id=bu.id WHERE b.user_id=?',
        [req.session.user.id], (err, bookings) => {
            res.render('dashboard', { user: req.session.user, bookings });
        });
});

app.post('/book', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { bus_id, seats } = req.body;
    db.query('SELECT * FROM buses WHERE id=?', [bus_id], (err, results) => {
        const bus = results[0];
        if (bus.available_seats >= seats) {
            const fare = bus.fare * seats;
            db.query('INSERT INTO bookings (user_id, bus_id, booking_date, seats_booked, total_fare) VALUES (?,?,CURDATE(),?,?)',
                [req.session.user.id, bus_id, seats, fare], () => {
                    db.query('UPDATE buses SET available_seats=? WHERE id=?',
                        [bus.available_seats - seats, bus_id], () => {
                            res.redirect('/dashboard');
                        });
                });
        } else res.send('Not enough seats!');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));