const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");

async function bootstrap() {
  await connectDB();

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${env.port}`);
  });
}

bootstrap();
