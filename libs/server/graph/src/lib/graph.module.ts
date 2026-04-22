import { Module } from '@nestjs/common';
import { GraphController } from './graph.controller';
import { GraphImporter } from './graph.importer';
import { GraphLoader } from './graph.loader';
import { GraphService } from './graph.service';

@Module({
  controllers: [GraphController],
  providers: [GraphLoader, GraphImporter, GraphService],
})
export class GraphModule {}
