/**
 * SVG资源属性检查器
 * 用于在属性检查器中显示和编辑SVG资源的属性
 */

type Selector<$> = { $: Record<keyof $, any | null> } & {
    dispatch(str: string): void;
    assetList: any[];
    metaList: any[];
    onPropertyChange(property: string, value: any): void;
};

export const $ = {
    svgContent: ".svg-content",
    width: ".width",
    height: ".height",
    defaultColor: ".default-color",
    title: ".title",
    description: ".description",
    author: ".author",
    license: ".license",
    renderScale: ".render-scale",
    antialias: ".antialias",
    complexityScore: ".complexity-score",
    isAnimated: ".is-animated",
};

export const template = `
<div class="svg-asset-inspector">
    <ui-section>
        <ui-label slot="header">SVG基本信息</ui-label>
        <div class="section-content">
            <ui-prop>
                <ui-label slot="label">宽度</ui-label>
                <ui-num-input slot="content" class="width" step="1"></ui-num-input>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label">高度</ui-label>
                <ui-num-input slot="content" class="height" step="1"></ui-num-input>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label">默认颜色</ui-label>
                <ui-color slot="content" class="default-color"></ui-color>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label">渲染缩放</ui-label>
                <ui-num-input slot="content" class="render-scale" step="0.1" min="0.1" max="10"></ui-num-input>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label">抗锯齿</ui-label>
                <ui-checkbox slot="content" class="antialias"></ui-checkbox>
            </ui-prop>
        </div>
    </ui-section>

    <ui-section>
        <ui-label slot="header">元数据</ui-label>
        <div class="section-content">
            <ui-prop>
                <ui-label slot="label">标题</ui-label>
                <ui-input slot="content" class="title"></ui-input>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label">描述</ui-label>
                <ui-textarea slot="content" class="description" rows="3"></ui-textarea>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label">作者</ui-label>
                <ui-input slot="content" class="author"></ui-input>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label">许可证</ui-label>
                <ui-input slot="content" class="license"></ui-input>
            </ui-prop>
        </div>
    </ui-section>

    <ui-section>
        <ui-label slot="header">SVG信息</ui-label>
        <div class="section-content">
            <ui-prop>
                <ui-label slot="label">复杂度评分</ui-label>
                <ui-num-input slot="content" class="complexity-score" step="1" readonly></ui-num-input>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label">包含动画</ui-label>
                <ui-checkbox slot="content" class="is-animated" readonly></ui-checkbox>
            </ui-prop>
            <ui-prop>
                <ui-label slot="label">SVG内容</ui-label>
                <ui-textarea slot="content" class="svg-content" rows="10" readonly></ui-textarea>
            </ui-prop>
        </div>
    </ui-section>
</div>

<style>
.svg-asset-inspector {
    padding: 10px;
}

.section-content {
    padding: 10px;
}

ui-section {
    margin-bottom: 15px;
}

ui-prop {
    margin-bottom: 8px;
}

ui-textarea {
    font-family: monospace;
    font-size: 12px;
}
</style>
`;

type PanelThis = Selector<typeof $>;

export function update(this: PanelThis, assetList: any[], metaList: any[]) {
    this.assetList = assetList;
    this.metaList = metaList;

    if (metaList.length === 0 || !metaList[0].userData) {
        return;
    }

    const userData = metaList[0].userData;

    // 更新基本属性
    this.$.width.value = userData.width || 0;
    this.$.height.value = userData.height || 0;
    this.$.defaultColor.value = userData.defaultColor || "#ffffff";
    this.$.renderScale.value = userData.renderScale || 1;
    this.$.antialias.value = userData.antialias !== undefined ? userData.antialias : true;

    // 更新元数据
    this.$.title.value = userData.title || "";
    this.$.description.value = userData.description || "";
    this.$.author.value = userData.author || "";
    this.$.license.value = userData.license || "";

    // 更新SVG信息
    this.$.complexityScore.value = userData.complexityScore || 0;
    this.$.isAnimated.value = userData.isAnimated || false;

    // 显示部分SVG内容（前500个字符）
    const svgContent = userData.svgContent || "";
    const previewContent = svgContent.length > 500 ? svgContent.substring(0, 500) + "..." : svgContent;
    this.$.svgContent.value = previewContent;
}

export function ready(this: PanelThis) {
    // 监听属性变化
    this.$.width.addEventListener("confirm", () => this.onPropertyChange("width", this.$.width.value));
    this.$.height.addEventListener("confirm", () => this.onPropertyChange("height", this.$.height.value));
    this.$.defaultColor.addEventListener("confirm", () => this.onPropertyChange("defaultColor", this.$.defaultColor.value));
    this.$.renderScale.addEventListener("confirm", () => this.onPropertyChange("renderScale", this.$.renderScale.value));
    this.$.antialias.addEventListener("confirm", () => this.onPropertyChange("antialias", this.$.antialias.value));
    this.$.title.addEventListener("confirm", () => this.onPropertyChange("title", this.$.title.value));
    this.$.description.addEventListener("confirm", () => this.onPropertyChange("description", this.$.description.value));
    this.$.author.addEventListener("confirm", () => this.onPropertyChange("author", this.$.author.value));
    this.$.license.addEventListener("confirm", () => this.onPropertyChange("license", this.$.license.value));
}

export function close(this: PanelThis) {
    // 清理工作
}

// 属性变化处理方法
function onPropertyChange(this: PanelThis, property: string, value: any) {
    if (!this.metaList || this.metaList.length === 0) {
        return;
    }

    // 更新所有选中的meta
    this.metaList.forEach((meta: any) => {
        if (meta.userData) {
            meta.userData[property] = value;
            meta.userData.isDirty = true;
            meta.userData.lastModified = Date.now();
        }
    });

    // 通知属性检查器数据已更改
    this.dispatch("change");
}

// 将方法绑定到PanelThis原型
declare global {
    interface PanelThisProto {
        onPropertyChange(property: string, value: any): void;
    }
}

// 使用类型断言来扩展原型
(onPropertyChange as any).prototype = onPropertyChange;
