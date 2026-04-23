import { Module } from '@nestjs/common';
import { GraphModule as GraphCoreModule } from '@libs/server-graph';
import { GraphController } from './graph.controller.js';

@Module({
  imports: [GraphCoreModule],
  controllers: [GraphController],
})
export class GraphModule {}
