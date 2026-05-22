const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token bulunamadı' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.player = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
};