module.exports = (req, res, next) => {
  if (!req.player || !req.player.isAdmin) {
    return res.status(403).json({ error: 'Yetkisiz erişim' });
  }
  next();
};
