const express = require('express');
const router = express.Router();

router.use(require('./player/profile'));
router.use(require('./player/leaderboard'));
router.use(require('./player/activity'));
router.use(require('./player/settings'));
router.use(require('./player/glitter'));
router.use(require('./player/dailyReward'));
router.use(require('./player/levelBonus'));
router.use(require('./player/pvp'));

module.exports = router;
