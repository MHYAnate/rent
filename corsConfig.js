// corsConfig.js
import cors from 'cors';

export const corsOptions = {
  origin: 'http://localhost:3000',
  credentials: true
};

export default cors(corsOptions);