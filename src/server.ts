import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`API rodando na porta ${port}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
});
