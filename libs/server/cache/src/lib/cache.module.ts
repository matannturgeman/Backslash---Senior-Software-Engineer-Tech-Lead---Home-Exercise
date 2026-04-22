import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CACHE_SERVICE } from './cache.interface';

@Global()
@Module({
  providers: [
    CacheService,
    { provide: CACHE_SERVICE, useExisting: CacheService },
  ],
  exports: [CacheService, CACHE_SERVICE],
})
export class CacheModule {}
