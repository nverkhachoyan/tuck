import { Directory, File, Paths } from "expo-file-system";

export type PreviewStorage = {
	getPreviewUri(projectId: string, file: string): Promise<string | null>;
	savePreview(
		projectId: string,
		file: string,
		tempUri: string,
	): Promise<string>;
	copyPreview(fromId: string, file: string, toId: string): Promise<void>;
	removeProjectPreviews(projectId: string): Promise<void>;
};

const previewsDirectory = () => new Directory(Paths.cache, "previews");
const projectPreviewDirectory = (projectId: string) =>
	new Directory(previewsDirectory(), projectId);

export const previewStorage: PreviewStorage = {
	async getPreviewUri(projectId: string, file: string): Promise<string | null> {
		const previewFile = new File(projectPreviewDirectory(projectId), file);
		return previewFile.exists ? previewFile.uri : null;
	},

	async savePreview(
		projectId: string,
		file: string,
		tempUri: string,
	): Promise<string> {
		const directory = projectPreviewDirectory(projectId);
		directory.create({ intermediates: true, idempotent: true });
		const previewFile = new File(directory, file);
		await new File(tempUri).move(previewFile, { overwrite: true });
		return previewFile.uri;
	},

	async copyPreview(fromId: string, file: string, toId: string): Promise<void> {
		const source = new File(projectPreviewDirectory(fromId), file);
		if (!source.exists) return;
		const directory = projectPreviewDirectory(toId);
		directory.create({ intermediates: true, idempotent: true });
		await source.copy(new File(directory, file), { overwrite: true });
	},

	async removeProjectPreviews(projectId: string): Promise<void> {
		const directory = projectPreviewDirectory(projectId);
		if (directory.exists) directory.delete();
	},
};

export default previewStorage;
