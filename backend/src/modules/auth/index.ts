/**
 * Модуль авторизации
 * 
 * Публичный API модуля авторизации.
 * Экспортирует только необходимые функции и типы.
 * 
 * @module modules/auth
 */

export { hashPassword, verifyPassword } from './password.service';
export { ensureRootUser } from './ensureRootUser';
export {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  isPasswordVersionValid,
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type JwtPayloadWithUserData,
} from './token.service';
export { loginSchema, refreshSchema, type LoginInput, type RefreshInput } from './auth.schemas';

