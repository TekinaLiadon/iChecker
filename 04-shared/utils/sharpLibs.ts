import vipsSo from "#libvips" with {type: "file"};
import {renameSync} from "fs";
import os from "os";
import path from "path";

const target = path.join(os.tmpdir(), "libvips-cpp.so.8.18.6");
const tmp = `${target}.tmp-${process.pid}`;
await Bun.write(tmp, Bun.file(vipsSo as string));
renameSync(tmp, target);
