import 'reflect-metadata';
import { IS_PUBLIC_KEY, Public } from './auth.decorator';

describe('Public decorator', () => {
  it('marks method handler metadata as public', () => {
    class TestController {
      method() {
        return true;
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'method',
    );

    Public()(TestController.prototype, 'method', descriptor!);

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, descriptor!.value!)).toBe(true);
  });

  it('marks class metadata as public', () => {
    @Public()
    class TestController {}

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestController)).toBe(true);
  });
});
