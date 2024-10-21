import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

class MyIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    options = {
      ...options,
      cors: {
        origin: ['http://localhost:5173', '*'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    };
    return super.createIOServer(port, options);
  }
}
const corsOptions: CorsOptions = {
  origin: ['http://localhost:5173', '*'], // Allowed origins
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  credentials: true, // Allow cookies to be sent with cross-origin requests
  maxAge: 3600, // Cache preflight response for 1 hour
};
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new MyIoAdapter(app));
  app.enableCors(corsOptions);
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
