const app = require("../src/app");
const connectDB = require("../src/config/db");
const env = require("../src/config/env");

async function bootstrap() {
  await connectDB();

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${env.port}`);
  });
}

bootstrap();
