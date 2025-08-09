#!/usr/bin/env ts-node
import 'dotenv/config';
declare function testHttpApi(): Promise<boolean>;
export { testHttpApi };
