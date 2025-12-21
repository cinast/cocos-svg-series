import { _decorator, Asset, ImageAsset, Texture2D } from "cc";
const { ccclass, property } = _decorator;

@ccclass("SVGAsset")
export class SVGAsset extends Asset {
    // 基础SVG属性
    @property
    private _svgContent: string = "";

    @property
    public get svgContent(): string {
        return this._svgContent;
    }

    public set svgContent(value: string) {
        if (this._svgContent !== value) {
            this._svgContent = value;
            this.parseSVG();
            this.isDirty = true;
        }
    }

    @property
    public width: number = 0;

    @property
    public height: number = 0;

    @property
    public viewBox: string = "";

    @property
    public aspectRatio: number = 1;

    // 渲染配置属性
    @property
    public defaultColor: string = "#ffffff";

    @property
    public renderScale: number = 1;

    @property
    public antialias: boolean = true;

    @property
    public preserveAspectRatio: string = "xMidYMid meet";

    // 资源管理属性
    private cachedTextures: Map<string, Texture2D> = new Map();
    private previewAsset: ImageAsset | null = null;
    private lastRenderedSize: { width: number; height: number } = { width: 0, height: 0 };

    // 元数据属性
    @property
    public title: string = "";

    @property
    public description: string = "";

    @property
    public keywords: string[] = [];

    @property
    public author: string = "";

    @property
    public license: string = "";

    // 性能优化属性
    @property
    public complexityScore: number = 0;

    @property
    public optimizedSVG: string = "";

    @property
    public isAnimated: boolean = false;

    // 编辑状态属性
    @property
    public isDirty: boolean = true;

    @property
    public lastModified: number = Date.now();

    @property
    public sourceFile: string = "";

    // 私有DOM元素用于解析
    private svgElement: SVGSVGElement | null = null;
    private parser: DOMParser = new DOMParser();

    /**
     * 构造函数
     */
    constructor() {
        super();
    }

    /**
     * 解析SVG内容，提取元数据和尺寸信息
     */
    public parseSVG(): void {
        if (!this._svgContent) {
            this.width = 0;
            this.height = 0;
            this.viewBox = "";
            this.aspectRatio = 1;
            return;
        }

        try {
            const doc = this.parser.parseFromString(this._svgContent, "image/svg+xml");
            this.svgElement = doc.documentElement as unknown as SVGSVGElement;

            // 检查解析错误
            const parserError = doc.querySelector("parsererror");
            if (parserError) {
                console.error("SVG解析错误:", parserError.textContent);
                return;
            }

            // 提取尺寸信息
            const widthAttr = this.svgElement.getAttribute("width");
            const heightAttr = this.svgElement.getAttribute("height");
            const viewBoxAttr = this.svgElement.getAttribute("viewBox");

            this.viewBox = viewBoxAttr || "";

            if (viewBoxAttr) {
                const viewBoxParts = viewBoxAttr.split(" ").map(Number);
                if (viewBoxParts.length >= 4) {
                    this.width = viewBoxParts[2];
                    this.height = viewBoxParts[3];
                }
            }

            // 如果viewBox没有提供尺寸，使用width/height属性
            if (this.width === 0 && widthAttr) {
                this.width = this.parseDimension(widthAttr);
            }
            if (this.height === 0 && heightAttr) {
                this.height = this.parseDimension(heightAttr);
            }

            // 如果还是没有尺寸，使用默认值
            if (this.width === 0) this.width = 100;
            if (this.height === 0) this.height = 100;

            this.aspectRatio = this.height > 0 ? this.width / this.height : 1;

            // 提取元数据
            this.extractMetadata();

            // 计算复杂度
            this.calculateComplexity();

            // 检查是否包含动画
            this.checkForAnimation();

            // 生成优化版本
            this.optimizeSVG();

            this.isDirty = false;
            this.lastModified = Date.now();
        } catch (error) {
            console.error("解析SVG失败:", error);
        }
    }

    /**
     * 验证SVG格式是否正确
     */
    public validateSVG(): boolean {
        if (!this._svgContent) {
            return false;
        }

        try {
            const doc = this.parser.parseFromString(this._svgContent, "image/svg+xml");
            const parserError = doc.querySelector("parsererror");
            return !parserError;
        } catch (error) {
            return false;
        }
    }

    /**
     * 渲染指定尺寸的纹理
     */
    public async renderToTexture(width: number, height: number): Promise<Texture2D> {
        const cacheKey = `${width}x${height}_${this.renderScale}_${this.defaultColor}`;

        // 检查缓存
        if (this.cachedTextures.has(cacheKey)) {
            return this.cachedTextures.get(cacheKey)!;
        }

        // 创建Canvas
        const canvas = document.createElement("canvas");
        const renderWidth = Math.floor(width * this.renderScale);
        const renderHeight = Math.floor(height * this.renderScale);
        canvas.width = renderWidth;
        canvas.height = renderHeight;

        const ctx = canvas.getContext("2d")!;

        // 设置抗锯齿
        if (this.antialias) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
        }

        // 准备SVG字符串
        let svgToRender = this.optimizedSVG || this._svgContent;

        // 应用颜色覆盖
        if (this.defaultColor !== "#ffffff") {
            svgToRender = this.applyColorOverride(svgToRender, this.defaultColor);
        }

        // 设置SVG尺寸
        svgToRender = this.setSVGDimensions(svgToRender, width, height);

        // 渲染SVG到Canvas
        await this.renderSVGToCanvas(svgToRender, canvas);

        // 创建ImageAsset和Texture2D
        const imageAsset = new ImageAsset(canvas);
        const texture = new Texture2D();
        texture.image = imageAsset;

        // 缓存纹理
        this.cachedTextures.set(cacheKey, texture);
        this.lastRenderedSize = { width, height };

        return texture;
    }

    /**
     * 生成缩略图预览
     */
    public async generatePreview(): Promise<ImageAsset> {
        if (this.previewAsset) {
            return this.previewAsset;
        }

        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;

        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, 64, 64);

        if (this._svgContent) {
            // 准备SVG字符串
            let svgToRender = this.optimizedSVG || this._svgContent;

            // 计算适合预览的尺寸
            const previewSize = this.scaleToFit(64, 64);
            const x = (64 - previewSize.width) / 2;
            const y = (64 - previewSize.height) / 2;

            // 设置SVG尺寸
            svgToRender = this.setSVGDimensions(svgToRender, previewSize.width, previewSize.height);

            // 渲染SVG到Canvas
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = previewSize.width;
            tempCanvas.height = previewSize.height;

            await this.renderSVGToCanvas(svgToRender, tempCanvas);

            // 绘制到预览Canvas
            ctx.drawImage(tempCanvas, x, y, previewSize.width, previewSize.height);
        }

        this.previewAsset = new ImageAsset(canvas);
        return this.previewAsset;
    }

    /**
     * 优化SVG
     */
    public optimize(): void {
        this.optimizeSVG();
        this.isDirty = true;
    }

    /**
     * 批量修改填充颜色
     */
    public changeColor(newColor: string): void {
        this.defaultColor = newColor;
        this.isDirty = true;
        this.cachedTextures.clear(); // 清除缓存，因为颜色改变了
    }

    /**
     * 提取所有路径数据
     */
    public extractPaths(): string[] {
        if (!this.svgElement) {
            return [];
        }

        const paths: string[] = [];
        const pathElements = this.svgElement.querySelectorAll("path");

        pathElements.forEach((path) => {
            const d = path.getAttribute("d");
            if (d) {
                paths.push(d);
            }
        });

        return paths;
    }

    /**
     * 计算适合的尺寸
     */
    public scaleToFit(maxWidth: number, maxHeight: number): { width: number; height: number } {
        if (this.width === 0 || this.height === 0) {
            return { width: maxWidth, height: maxHeight };
        }

        const widthRatio = maxWidth / this.width;
        const heightRatio = maxHeight / this.height;
        const scale = Math.min(widthRatio, heightRatio);

        return {
            width: Math.floor(this.width * scale),
            height: Math.floor(this.height * scale),
        };
    }

    /**
     * 序列化为JSON
     */
    public serialize(): any {
        return {
            svgContent: this._svgContent,
            width: this.width,
            height: this.height,
            viewBox: this.viewBox,
            defaultColor: this.defaultColor,
            renderScale: this.renderScale,
            antialias: this.antialias,
            title: this.title,
            description: this.description,
            keywords: this.keywords,
            author: this.author,
            license: this.license,
            lastModified: this.lastModified,
            sourceFile: this.sourceFile,
        };
    }

    /**
     * 从JSON反序列化
     */
    public deserialize(data: any): void {
        this._svgContent = data.svgContent || "";
        this.width = data.width || 0;
        this.height = data.height || 0;
        this.viewBox = data.viewBox || "";
        this.defaultColor = data.defaultColor || "#ffffff";
        this.renderScale = data.renderScale || 1;
        this.antialias = data.antialias !== undefined ? data.antialias : true;
        this.title = data.title || "";
        this.description = data.description || "";
        this.keywords = data.keywords || [];
        this.author = data.author || "";
        this.license = data.license || "";
        this.lastModified = data.lastModified || Date.now();
        this.sourceFile = data.sourceFile || "";

        this.parseSVG();
    }

    // ========== 私有方法 ==========

    private parseDimension(dim: string): number {
        // 移除单位（px, pt, em等）
        const num = parseFloat(dim);
        return isNaN(num) ? 0 : num;
    }

    private extractMetadata(): void {
        if (!this.svgElement) return;

        // 提取<title>
        const titleElement = this.svgElement.querySelector("title");
        this.title = titleElement ? titleElement.textContent || "" : "";

        // 提取<desc>
        const descElement = this.svgElement.querySelector("desc");
        this.description = descElement ? descElement.textContent || "" : "";

        // 提取metadata
        const metadataElement = this.svgElement.querySelector("metadata");
        if (metadataElement) {
            // 这里可以解析更复杂的元数据
            const text = metadataElement.textContent || "";
            if (text.includes("author:")) {
                this.author = text.split("author:")[1].split("\n")[0].trim();
            }
            if (text.includes("license:")) {
                this.license = text.split("license:")[1].split("\n")[0].trim();
            }
        }
    }

    private calculateComplexity(): void {
        if (!this.svgElement) {
            this.complexityScore = 0;
            return;
        }

        let score = 0;

        // 计算路径数量
        const paths = this.svgElement.querySelectorAll("path");
        score += paths.length * 10;

        // 计算其他图形元素
        const circles = this.svgElement.querySelectorAll("circle, ellipse");
        score += circles.length * 5;

        const rects = this.svgElement.querySelectorAll("rect");
        score += rects.length * 3;

        const lines = this.svgElement.querySelectorAll("line, polyline, polygon");
        score += lines.length * 2;

        // 计算文本元素
        const texts = this.svgElement.querySelectorAll("text");
        score += texts.length * 8;

        // 计算分组和变换
        const groups = this.svgElement.querySelectorAll("g");
        score += groups.length * 1;

        this.complexityScore = score;
    }

    private checkForAnimation(): void {
        if (!this.svgElement) {
            this.isAnimated = false;
            return;
        }

        const hasAnimation = this.svgElement.querySelector("animate, animateTransform, animateMotion, set");
        this.isAnimated = !!hasAnimation;
    }

    private optimizeSVG(): void {
        if (!this.svgElement) {
            this.optimizedSVG = this._svgContent;
            return;
        }

        // 克隆元素进行优化
        const optimizedElement = this.svgElement.cloneNode(true) as SVGSVGElement;

        // 移除注释
        this.removeComments(optimizedElement);

        // 移除空元素
        this.removeEmptyElements(optimizedElement);

        // 压缩空白
        this.compressWhitespace(optimizedElement);

        // 序列化回字符串
        const serializer = new XMLSerializer();
        this.optimizedSVG = serializer.serializeToString(optimizedElement);
    }

    private removeComments(element: Element): void {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT, null);

        const comments: Comment[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
            comments.push(node as Comment);
        }

        comments.forEach((comment) => comment.remove());
    }

    private removeEmptyElements(element: Element): void {
        const emptyElements = Array.from(element.querySelectorAll("*")).filter((el) => {
            return !el.hasChildNodes() && !el.getAttribute("d") && !el.getAttribute("points");
        });

        emptyElements.forEach((el) => el.remove());
    }

    private compressWhitespace(element: Element): void {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

        let node: Node | null;
        while ((node = walker.nextNode())) {
            const textNode = node as Text;
            textNode.textContent = textNode.textContent?.replace(/\s+/g, " ").trim() || "";
        }
    }

    private applyColorOverride(svgString: string, color: string): string {
        // 简单的颜色替换：将所有fill属性（除了"none"）替换为指定颜色
        return svgString.replace(/fill="([^"]*)"/g, (match, fillValue) => {
            if (fillValue === "none" || fillValue === "transparent") {
                return match; // 保持透明填充不变
            }
            return `fill="${color}"`;
        });
    }

    private setSVGDimensions(svgString: string, width: number, height: number): string {
        // 添加或更新width和height属性
        let result = svgString;

        // 更新width属性
        if (result.includes('width="')) {
            result = result.replace(/width="[^"]*"/, `width="${width}"`);
        } else {
            result = result.replace(/<svg/, `<svg width="${width}"`);
        }

        // 更新height属性
        if (result.includes('height="')) {
            result = result.replace(/height="[^"]*"/, `height="${height}"`);
        } else {
            result = result.replace(/<svg/, `<svg height="${height}"`);
        }

        // 添加preserveAspectRatio
        if (!result.includes('preserveAspectRatio="')) {
            result = result.replace(/<svg/, `<svg preserveAspectRatio="${this.preserveAspectRatio}"`);
        }

        return result;
    }

    private renderSVGToCanvas(svgString: string, canvas: HTMLCanvasElement): Promise<void> {
        return new Promise((resolve, reject) => {
            const ctx = canvas.getContext("2d")!;

            // 创建Blob和URL
            const blob = new Blob([svgString], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                // 清空画布
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // 绘制SVG
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // 清理URL
                URL.revokeObjectURL(url);
                resolve();
            };

            img.onerror = (error) => {
                URL.revokeObjectURL(url);
                reject(new Error(`SVG渲染失败: ${error}`));
            };

            img.src = url;
        });
    }
}
