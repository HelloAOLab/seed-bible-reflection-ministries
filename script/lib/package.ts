import { execSync } from "child_process";
import { readdir, readFile, writeFile } from "fs/promises";
import * as path from "path";
import fs from "fs";
import "dotenv/config";
import type { BotsState } from "@casual-simulation/aux-common";

export async function packageSingle(
  pkg: string,
  stdio: "inherit" | "ignore" = "inherit"
) {
  try {
    console.log(`Packaging: ${pkg}`);

    const packagePath = path.resolve("packages", pkg);
    const distPath = path.resolve("dist", `${pkg}.aux`);
    const API_KEY = process.env.APOLOGIST_API_KEY;

    if (pkg === "askKen-extension" || pkg === "discovery-extension") {
      const hasApiKey = !!API_KEY;

      console.log(
        `Injecting API key for ${pkg}: ${hasApiKey ? "found" : "not found"}`
      );

      let botFilePath;

      if (pkg === "discovery-extension") {
        botFilePath = path.resolve(
          packagePath,
          "ext_discovery",
          "host",
          "managers",
          "ext_discovery.host.managers.bot.aux"
        );
      } else {
        botFilePath = path.resolve(
          packagePath,
          "ext_askKen",
          "host",
          "managers",
          "ext_askKen.host.managers.bot.aux"
        );
      }
      console.log(pkg, botFilePath);

      if (!botFilePath || !fs.existsSync(botFilePath)) {
        console.error("Bot file not found:", botFilePath);
      } else {
        const original = await readFile(botFilePath, "utf-8");
        const botsData = JSON.parse(original);

        console.log(`Bots in ${pkg}:`, botsData);

        for (const id in botsData.state) {
          const bot = botsData.state[id];

          if (bot.tags) {
            bot.tags.APOLOGIST_API_KEY = API_KEY;
          }
        }

        await writeFile(
          botFilePath,
          JSON.stringify(botsData, null, 2),
          "utf-8"
        );

        console.log("API key injected into:", botFilePath);
      }
    }

    execSync(`casualos pack-aux --overwrite "${packagePath}" "${distPath}"`, {
      stdio,
    });

    console.log(`Wrote: ${distPath}`);
    return true;
  } catch (e) {
    console.error(`Failed to package ${pkg}:`, e);
    return false;
  }
}

export async function packageAll(stdio: "inherit" | "ignore" = "inherit") {
  console.log("aaaaaaaa");
  const packages = await listPackages();
  await Promise.all(packages.map((pkg) => packageSingle(pkg, stdio)));
}

export async function readPackage(packageName: string) {
  const packageAux = path.resolve("dist", `${packageName}.aux`);
  const packageData = await readFile(packageAux, "utf-8");
  const aux = JSON.parse(packageData);
  return aux;
}

export async function listPackages() {
  return await readdir("packages");
}

/**
 * Creates a new stored aux that only includes bots in the "shared" space and
 * removes certain tags from the bots.
 * @param aux The original aux to clean up.
 */
export function cleanupAux(aux: BotsState) {
  const result: BotsState = {};

  const ignoredTags = ["creator", "abIDOrigin"];

  for (const id in aux) {
    const bot = aux[id];
    if (!bot) {
      continue;
    }
    if (
      (bot.space && !["shared", "local"].includes(bot.space)) ||
      bot.tags.aoIgnore
    ) {
      continue;
    }
    result[id] = {
      id: bot.id,
      space: bot.space,
      tags: { ...bot.tags },
    };

    for (const tag of ignoredTags) {
      delete result[id].tags[tag];
    }
  }

  return result;
}
