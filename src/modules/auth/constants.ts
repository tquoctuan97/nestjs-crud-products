export const jwtConstants = {
  secret: `${process.env.JWT_SECRET}`,
  accessTokenExpiryTime: `${process.env.ACCESS_TOKEN_EXPIRY_TIME}`,
  refreshTokenExpiryTime: `${process.env.REFRESH_TOKEN_EXPIRY_TIME}`,
};
