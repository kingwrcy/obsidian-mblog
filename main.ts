import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
	Vault,
	parseYaml,
	requestUrl,
} from "obsidian";

interface MBlogSettings {
	token: string;
}

const DEFAULT_SETTINGS: MBlogSettings = {
	token: "",
};

interface MBlogArticleMetaInfo {
	title: string;
	link?: string;
	pubDate?: string;
	tags?: string;
	draft?: boolean;
}

const publish2Mblog = async (
	vault: Vault,
	file: TAbstractFile,
	token: string
) => {
	if (!token) {
		new Notice("Mblog token没有设置,先去设置.");
		return;
	}
	if (file instanceof TFile) {
		const content = await vault.cachedRead(file);
		const regex = /---(.*?)---/s;
		const match = content.match(regex);
		const contentBetweenDashes = match ? match[1] : null;
		if (!contentBetweenDashes) {
			new Notice("文章缺少front matter信息部分,无法发布.");
			return;
		}
		const metainfo = parseYaml(
			contentBetweenDashes
		) as MBlogArticleMetaInfo;
		if (!metainfo.title) {
			new Notice("front matter信息部分缺少title字段,无法发布.");
			return;
		}
		const reg = /---\n([\s\S]*?)\n---\n([\s\S]*)/;
		const contentMatch = content.match(reg);
		const contentAfterSecondDash = contentMatch
			? contentMatch[2].trim()
			: null;
		if (!contentAfterSecondDash) {
			new Notice("正文部分为空,无法发布.");
			return;
		}
		const res = await requestUrl({
			url: "https://bzur0u.laf.run/api/v1/createPost",
			method: "POST",
			headers: {
				"content-type": "application/json;charset=utf-8",
				"x-mblog-token": token,
			},
			body: JSON.stringify({
				title: metainfo.title,
				link: metainfo.link || metainfo.title,
				pubDate: metainfo.pubDate || new Date(),
				tags: metainfo.tags || "",
				draft: Boolean(metainfo.draft || false),
				content: contentAfterSecondDash,
			}),
		});
		if (res.json.success) {
			new Notice("发布成功!");
			return;
		}
		new Notice(`发布失败,${res.json.msg}.`);
	} else if (file instanceof TFolder) {
		new Notice("暂不支持直接发布文件夹!");
	}
};

export default class MBlogPlugin extends Plugin {
	settings: MBlogSettings;

	async onload() {
		const { vault } = this.app;
		await this.loadSettings();
		const token = this.settings.token;
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFile) {
					menu.addItem((item) => {
						item.setTitle("发布到MBlog平台 👈")
							.setIcon("upload-cloud")
							.onClick(async () => {
								publish2Mblog(vault, file, token);
							});
					});
				}
			})
		);

		this.addSettingTab(new MBlogSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MBlogSettingTab extends PluginSettingTab {
	plugin: MBlogPlugin;

	constructor(app: App, plugin: MBlogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Token")
			.setDesc("Mblog开发者Token,付费后才有.")
			.addText((text) =>
				text
					.setPlaceholder("输入你的token")
					.setValue(this.plugin.settings.token)
					.onChange(async (value) => {
						this.plugin.settings.token = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
