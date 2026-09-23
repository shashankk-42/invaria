import express from 'express';
import { getOrder } from './controller';
const app = express();
app.get('/api/orders/:id', authenticate, getOrder);
