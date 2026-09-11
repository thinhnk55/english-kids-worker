/* eslint-disable */
interface __BaseEnv_Env {
	ASSETS: R2Bucket;
	DB: D1Database;
	ASSET_BASE_URL: string;
	JWT_PUBLIC_KEY_PEM: string;
}
declare namespace Cloudflare {
	interface GlobalProps {
		mainModule: typeof import("./index");
	}
	interface Env extends __BaseEnv_Env {}
}
interface Env extends __BaseEnv_Env {}
type StringifyValues<EnvType extends Record<string, unknown>> = {
	[Binding in keyof EnvType]: EnvType[Binding] extends string ? EnvType[Binding] : string;
};
declare namespace NodeJS {
	interface ProcessEnv extends StringifyValues<Pick<Cloudflare.Env, "ASSET_BASE_URL" | "JWT_PUBLIC_KEY_PEM">> {}
}
