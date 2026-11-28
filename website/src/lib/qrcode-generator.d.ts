declare module '$lib/qrcode-generator' {
	interface QRCodeInstance {
		addData(data: string): void;
		make(): void;
		createDataURL(cellSize?: number, margin?: number): string;
	}

	const qrcode: (typeNumber: number | string, errorCorrectionLevel: string) => QRCodeInstance;
	export default qrcode;
}
