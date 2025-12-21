import { _decorator, Component, Sprite, SpriteFrame, Texture2D, UITransform, ImageAsset } from "cc";
import { SVGAsset } from "./SVGAssets";
const { ccclass, property, executeInEditMode, requireComponent, menu } = _decorator;

@ccclass("SVGSprite")
@menu("2D/SVGSprite")
@executeInEditMode
@requireComponent(Sprite)
export class SVGSprite extends Component {
    @property
    private _svgContent: string = "";
    private _svgFile: SVGAsset | null = null;

    @property({
        displayName: "使用文本输入",
        tooltip: "勾选后直接粘贴SVG代码，取消则选择svg文件",
    })
    useTextSVG: boolean = false;

    // 文本模式下的SVG代码
    @property({
        type: String,
        multiline: true,
        displayName: "SVG代码",
        tooltip: "直接粘贴SVG代码",
        visible: function (this: SVGSprite) {
            return this.useTextSVG;
        },
    })
    private _svgText: string = "";

    // 文件模式下的SVG文件引用
    @property({
        type: SVGAsset,
        displayName: "SVG文件",
        tooltip: "选择一个svg文件",
        visible: function (this: SVGSprite) {
            return !this.useTextSVG;
        },
    })

    // 统一的getter，根据模式返回对应内容
    get svgContent(): string {
        if (this.useTextSVG) {
            return this._svgText;
        } else {
            return this._svgFile ? this._svgFile.svgContent : "";
        }
    }

    // 统一setter，根据模式设置对应属性
    set svgContent(value: string | SVGAsset) {
        if (typeof value === "string") {
            // 字符串输入
            if (this._svgText !== value) {
                this._svgText = value;
                this._svgFile = null; // 清除文件引用
                this.renderSVG();
            }
        } else if (value instanceof SVGAsset) {
            // 文件输入
            if (this._svgFile !== value) {
                this._svgFile = value;
                this._svgText = ""; // 清除文本内容
                this.renderSVG();
            }
        }
    }

    @property({
        tooltip: "SVG渲染宽度",
    })
    public svgWidth: number = 256;

    @property({
        tooltip: "SVG渲染高度",
    })
    public svgHeight: number = 256;

    @property
    private sprite: Sprite = null!;

    @property
    private _color: string = "#ffffff";

    @property({
        displayName: "颜色覆盖",
    })
    get color(): string {
        return this._color;
    }

    set color(value: string) {
        if (this._color !== value) {
            this._color = value;
            this.updateSVGColor();
        }
    }

    private svgElement: SVGSVGElement = null!;
    private canvas: HTMLCanvasElement = null!;

    onLoad() {
        this.sprite = this.getComponent(Sprite)!;
        this.initSVGCanvas();
        this.renderSVG();
    }

    private initSVGCanvas() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.getComponent(UITransform)!.width;
        this.canvas.height = this.getComponent(UITransform)!.height;

        // 创建SVG元素
        this.svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgElement.setAttribute("width", "100%");
        this.svgElement.setAttribute("height", "100%");
        this.svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    private async renderSVG() {
        if (!this._svgContent) return;

        try {
            // 解析SVG
            const parser = new DOMParser();
            const doc = parser.parseFromString(this._svgContent, "image/svg+xml");
            const svg = doc.documentElement;

            // 清空并添加新内容
            while (this.svgElement.firstChild) {
                this.svgElement.removeChild(this.svgElement.firstChild);
            }

            // 复制所有子元素
            for (const child of Array.from(svg.children)) {
                this.svgElement.appendChild(child.cloneNode(true));
            }

            // 应用颜色
            this.updateSVGColor();

            // 渲染到纹理
            await this.renderToTexture();
        } catch (error) {
            console.error("SVG解析失败:", error);
        }
    }

    private updateSVGColor() {
        if (!this.svgElement) return;

        // 查找所有路径元素并设置颜色
        const paths = this.svgElement.querySelectorAll("path");
        paths.forEach((path) => {
            if (!path.getAttribute("fill") || path.getAttribute("fill") !== "none") {
                path.setAttribute("fill", this._color);
            }
        });
    }

    private renderToTexture(): Promise<void> {
        return new Promise((resolve) => {
            // 创建图片对象
            const svgString = new XMLSerializer().serializeToString(this.svgElement);
            const blob = new Blob([svgString], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                // 绘制到canvas
                const ctx = this.canvas.getContext("2d")!;
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

                // 创建纹理
                this.createTexture();
                URL.revokeObjectURL(url);
                resolve();
            };

            img.src = url;
        });
    }

    private createTexture() {
        const imageAsset = new ImageAsset(this.canvas);
        const texture = new Texture2D();
        texture.image = imageAsset;

        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;

        if (this.sprite) {
            this.sprite.spriteFrame = spriteFrame;
        }
    }

    // 动态更新SVG属性
    public setSVGAttribute(pathId: string, attribute: string, value: string) {
        const element = this.svgElement.querySelector(`#${pathId}`);
        if (element) {
            element.setAttribute(attribute, value);
            this.renderToTexture();
        }
    }

    /**
     * 在属性检查器中切换模式时的回调
     */
    @property({
        visible: false,
    })
    private onModeChanged(): void {
        // 当模式切换时，可以在这里添加额外逻辑
        console.log(`模式切换为: ${this.useTextSVG ? "文本输入" : "文件选择"}`);
        this.renderSVG();
    }

    /**
     * 手动刷新SVG内容
     */
    public refresh(): void {
        this.renderSVG();
    }

    /**
     * 获取当前模式描述
     */
    public get modeDescription(): string {
        return this.useTextSVG
            ? `文本模式: ${this._svgText.length} 字符`
            : `文件模式: ${this._svgFile ? this._svgFile.name : "无文件"}`;
    }
    onDestroy() {
        if (this.svgElement) {
            this.svgElement.remove();
        }
    }
}
