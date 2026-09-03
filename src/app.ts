import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './api/routes/index.js';
import { errorHandler } from './api/middlewares/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

const docPath = [
  path.join(__dirname, 'api/docs/swagger.json'),
  path.join(process.cwd(), 'src/api/docs/swagger.json'),
  path.join(process.cwd(), 'dist/api/docs/swagger.json'),
].find(fs.existsSync);

if (docPath) {
  const swaggerJson = JSON.parse(fs.readFileSync(docPath, 'utf-8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerJson));
}

app.get('/', (_req, res) => {
  res.json({
    projeto: 'API Rede Raízes do Nordeste - Trilha Back-End',
    status: 'online',
    documentacao: '/docs',
    endpoints: '/api',
  });
});

app.use('/api', routes);
app.use(errorHandler);

export default app;
