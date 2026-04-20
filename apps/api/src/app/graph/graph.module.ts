import { Module } from '@nestjs/common';
import { GraphController } from './graph.controller.js';
import { GraphImporter } from './graph.importer.js';
import { GraphLoader } from './graph.loader.js';
import { GraphService } from './graph.service.js';

@Module({
  controllers: [GraphController],
  providers: [GraphLoader, GraphImporter, GraphService],
})
export class GraphModule {}
