import { Module } from '@nestjs/common';
import { GraphImporter } from './graph.importer';
import { GraphLoader } from './graph.loader';
import { GraphService } from './graph.service';

@Module({
  providers: [GraphLoader, GraphImporter, GraphService],
  exports: [GraphService],
})
export class GraphModule {}
