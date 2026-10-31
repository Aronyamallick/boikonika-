import { Controller, Delete, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CapturedMessages } from '../../infra/messaging/drivers';

/**
 * Development helpers, registered only when NODE_ENV is not production (see AppModule): read the
 * emails and SMS captured by the log drivers, so OTP flows can be tested without real providers.
 */
@ApiExcludeController()
@Controller('dev')
export class DevController {
  @Public()
  @Get('outbox')
  outbox(@Query('to') to?: string) {
    return CapturedMessages.list(to);
  }

  @Public()
  @Delete('outbox')
  clear() {
    CapturedMessages.clear();
    return null;
  }
}
