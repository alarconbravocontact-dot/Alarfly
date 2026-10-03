const { Router } = require('express');
const validate = require('../middlewares/validate');
const { loginSchema, acceptInvitationSchema, verifyTwoFactorSchema, signupSchema } = require('./auth.validator');
const authController = require('./auth.controller');

const router = Router();

router.post('/login', validate(loginSchema), authController.login);
router.post('/verify-2fa', validate(verifyTwoFactorSchema), authController.verifyTwoFactor);
router.post('/accept-invitation', validate(acceptInvitationSchema), authController.acceptInvitation);
router.post('/signup', validate(signupSchema), authController.signup);

module.exports = router;
