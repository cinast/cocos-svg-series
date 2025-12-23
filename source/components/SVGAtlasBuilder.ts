import { _decorator, Component, SpriteFrame, Texture2D, ImageAsset, Rect, Vec2 } from "cc";
const { ccclass, property, executeInEditMode, menu, icon } = _decorator;

import { SVGSpriteCache } from "./SVGSpriteCache";

/**
 * 图集条目接口
 */
interface AtlasEntry {
    svgContent: string;
    uvRect: Rect; // UV坐标（0-1范围）
    pixelRect: Rect; // 像素坐标
    size: Vec2; // 原始尺寸
}

/**
 * 图集映射接口
 */
interface AtlasMapping {
    atlasName: string;
    entryKey: string;
}

/**
 * 图集数据接口
 */
interface AtlasData {
    name: string;
    texture: Texture2D;
    spriteFrame: SpriteFrame;
    svgEntries: Map<string, AtlasEntry>;
    usedSpace: number; // 已使用空间比例（0-1）
    width: number;
    height: number;
}

/**
 * SVG图集构建器
 * 将多个SVG打包到单个纹理图集中，减少纹理切换开销
 */
@ccclass("SVGAtlasBuilder")
@icon("../../Inkpen.png")
@menu("2D/SVGAtlasBuilder")
@executeInEditMode
export class SVGAtlasBuilder extends Component {
    // ========== 图集配置 ==========

    @property({
        tooltip: "图集最大宽度",
        displayName: "最大宽度",
        min: 64,
        max: 4096,
    })
    private maxAtlasWidth: number = 1024;

    @property({
        tooltip: "图集最大高度",
        displayName: "最大高度",
        min: 64,
        max: 4096,
    })
    private maxAtlasHeight: number = 1024;

    @property({
        tooltip: "纹理间距（像素）",
        displayName: "纹理间距",
        min: 0,
        max: 32,
    })
    private padding: number = 2;

    @property({
        tooltip: "启用自动图集构建",
        displayName: "自动构建",
    })
    private enableAutoAtlas: boolean = true;

    @property({
        tooltip: "图集构建阈值（SVG数量）",
        displayName: "构建阈值",
        min: 2,
        max: 100,
    })
    private buildThreshold: number = 10;

    // ========== 性能配置 ==========

    @property({
        tooltip: "启用运行时图集更新",
        displayName: "运行时更新",
    })
    private enableRuntimeUpdates: boolean = false;

    @property({
        tooltip: "最大图集数量",
        displayName: "最大图集数",
        min: 1,
        max: 10,
    })
    private maxAtlases: number = 3;

    // ========== 内部状态 ==========

    private atlases: Map<string, AtlasData> = new Map(); // 图集名称 -> 图集数据
    private svgToAtlasMapping: Map<string, AtlasMapping> = new Map(); // SVG内容 -> 图集映射
    private pendingSVGs: Set<string> = new Set(); // 待处理SVG

    // ========== 生命周期方法 ==========

    onLoad() {
        this.initializeAtlasBuilder();
    }

    onDestroy() {
        this.cleanupAtlasBuilder();
    }

    update(deltaTime: number) {
        if (this.enableAutoAtlas && this.pendingSVGs.size >= this.buildThreshold) {
            this.processPendingSVGs().catch(console.error);
        }
    }

    // ========== 公共方法 ==========

    /**
     * 添加SVG到图集构建队列
     * @param svgContent SVG内容
     * @param width 宽度
     * @param height 高度
     * @param color 颜色（可选）
     */
    public addSVGToAtlas(svgContent: string, width: number, height: number, color?: string): void {
        const key = this.generateSVGKey(svgContent, width, height, color);

        if (!this.svgToAtlasMapping.has(key)) {
            this.pendingSVGs.add(key);

            // 如果启用了自动构建且达到阈值，立即处理
            if (this.enableAutoAtlas && this.pendingSVGs.size >= this.buildThreshold) {
                this.processPendingSVGs().catch(console.error);
            }
        }
    }

    /**
     * 获取SVG的图集精灵帧
     * @param svgContent SVG内容
     * @param width 宽度
     * @param height 高度
     * @param color 颜色（可选）
     * @returns Promise<SpriteFrame> 返回图集中的精灵帧
     */
    public async getSVGFromAtlas(svgContent: string, width: number, height: number, color?: string): Promise<SpriteFrame | null> {
        const key = this.generateSVGKey(svgContent, width, height, color);

        // 检查是否已在图集中
        const mapping = this.svgToAtlasMapping.get(key);
        if (mapping) {
            const atlas = this.atlases.get(mapping.atlasName);
            if (atlas) {
                return atlas.spriteFrame;
            }
        }

        // 如果不在图集中且启用了运行时更新，尝试添加到图集
        if (this.enableRuntimeUpdates) {
            await this.addSVGToAtlasAndBuild(svgContent, width, height, color);

            // 重新检查
            const newMapping = this.svgToAtlasMapping.get(key);
            if (newMapping) {
                const atlas = this.atlases.get(newMapping.atlasName);
                if (atlas) {
                    return atlas.spriteFrame;
                }
            }
        }

        return null;
    }

    /**
     * 手动构建图集
     * @param svgContents SVG内容数组（带尺寸和颜色）
     */
    public async buildAtlas(
        svgContents: Array<{
            content: string;
            width: number;
            height: number;
            color?: string;
        }>
    ): Promise<AtlasData | null> {
        if (svgContents.length === 0) {
            console.warn("没有SVG内容可构建图集");
            return null;
        }

        try {
            // 检查图集数量限制
            if (this.atlases.size >= this.maxAtlases) {
                console.warn("已达到最大图集数量限制");
                return this.mergeOrReplaceAtlas(svgContents);
            }

            // 创建新图集
            const atlasName = `atlas_${Date.now()}`;
            const atlasData = await this.createAtlas(atlasName, svgContents);

            if (atlasData) {
                this.atlases.set(atlasName, atlasData);

                // 更新映射
                svgContents.forEach((svg) => {
                    const key = this.generateSVGKey(svg.content, svg.width, svg.height, svg.color);
                    this.svgToAtlasMapping.set(key, {
                        atlasName,
                        entryKey: key,
                    });
                });

                console.log(`图集构建完成: ${atlasName}, 包含 ${svgContents.length} 个SVG`);
                return atlasData;
            }

            return null;
        } catch (error) {
            console.error("构建图集失败:", error);
            return null;
        }
    }

    /**
     * 获取所有图集信息
     */
    public getAllAtlasInfo(): Array<{
        name: string;
        svgCount: number;
        width: number;
        height: number;
        usedSpace: number;
    }> {
        const info: Array<{
            name: string;
            svgCount: number;
            width: number;
            height: number;
            usedSpace: number;
        }> = [];

        this.atlases.forEach((atlas, name) => {
            info.push({
                name,
                svgCount: atlas.svgEntries.size,
                width: atlas.width,
                height: atlas.height,
                usedSpace: atlas.usedSpace,
            });
        });

        return info;
    }

    /**
     * 清除指定图集
     * @param atlasName 图集名称
     */
    public clearAtlas(atlasName: string): void {
        const atlas = this.atlases.get(atlasName);
        if (atlas) {
            // 释放纹理资源
            if (atlas.texture) {
                atlas.texture.destroy();
            }

            // 移除映射
            atlas.svgEntries.forEach((entry, key) => {
                this.svgToAtlasMapping.delete(key);
            });

            // 移除图集
            this.atlases.delete(atlasName);

            console.log(`已清除图集: ${atlasName}`);
        }
    }

    /**
     * 清除所有图集
     */
    public clearAllAtlases(): void {
        this.atlases.forEach((atlas, name) => {
            if (atlas.texture) {
                atlas.texture.destroy();
            }
        });

        this.atlases.clear();
        this.svgToAtlasMapping.clear();
        this.pendingSVGs.clear();

        console.log("已清除所有图集");
    }

    /**
     * 优化图集空间使用
     */
    public async optimizeAtlases(): Promise<void> {
        const optimizationPromises: Promise<void>[] = [];

        this.atlases.forEach((atlas, name) => {
            if (atlas.usedSpace < 0.6) {
                // 空间使用率低于60%
                optimizationPromises.push(this.optimizeAtlas(name));
            }
        });

        await Promise.all(optimizationPromises);
    }

    // ========== 私有方法 ==========

    /**
     * 初始化图集构建器
     */
    private initializeAtlasBuilder(): void {
        this.atlases.clear();
        this.svgToAtlasMapping.clear();
        this.pendingSVGs.clear();

        console.log("SVGAtlasBuilder 初始化完成");
    }

    /**
     * 清理图集构建器
     */
    private cleanupAtlasBuilder(): void {
        this.clearAllAtlases();
        console.log("SVGAtlasBuilder 清理完成");
    }

    /**
     * 生成SVG键
     */
    private generateSVGKey(svgContent: string, width: number, height: number, color?: string): string {
        const colorPart = color || "default";
        const hash = this.calculateSimpleHash(svgContent);
        return `${hash}_${width}x${height}_${colorPart}`;
    }

    /**
     * 计算简单哈希
     */
    private calculateSimpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).substring(0, 8);
    }

    /**
     * 处理待处理SVG
     */
    private async processPendingSVGs(): Promise<void> {
        if (this.pendingSVGs.size === 0) return;

        // 收集待处理SVG的详细信息
        const svgDetails: Array<{
            content: string;
            width: number;
            height: number;
            color?: string;
        }> = [];

        // 这里需要从pendingSVGs中提取实际SVG内容
        // 简化实现：使用占位符
        this.pendingSVGs.forEach((key) => {
            // 解析键获取尺寸等信息
            const match = key.match(/(.+)_(\d+)x(\d+)_(.+)/);
            if (match) {
                const [, hash, widthStr, heightStr, color] = match;
                svgDetails.push({
                    content: `svg_hash_${hash}`, // 简化：实际应该存储SVG内容
                    width: parseInt(widthStr),
                    height: parseInt(heightStr),
                    color: color !== "default" ? color : undefined,
                });
            }
        });

        if (svgDetails.length > 0) {
            await this.buildAtlas(svgDetails);
            this.pendingSVGs.clear();
        }
    }

    /**
     * 添加SVG到图集并构建
     */
    private async addSVGToAtlasAndBuild(svgContent: string, width: number, height: number, color?: string): Promise<void> {
        const key = this.generateSVGKey(svgContent, width, height, color);

        // 检查是否有空间足够的现有图集
        const suitableAtlas = this.findSuitableAtlas(width, height);
        if (suitableAtlas) {
            await this.addToExistingAtlas(suitableAtlas.name, svgContent, width, height, color);
        } else {
            // 创建新图集
            await this.buildAtlas([
                {
                    content: svgContent,
                    width,
                    height,
                    color,
                },
            ]);
        }
    }

    /**
     * 查找合适的现有图集
     */
    private findSuitableAtlas(width: number, height: number): AtlasData | null {
        let bestAtlas: AtlasData | null = null;
        let bestSpaceUsage = Infinity;

        this.atlases.forEach((atlas) => {
            // 检查图集是否有足够空间
            if (
                atlas.usedSpace < 0.9 && // 使用率低于90%
                width <= atlas.width * (1 - atlas.usedSpace) &&
                height <= atlas.height * (1 - atlas.usedSpace)
            ) {
                // 选择空间使用率最高的图集（最满但仍有空间）
                const spaceLeft = 1 - atlas.usedSpace;
                if (spaceLeft < bestSpaceUsage) {
                    bestSpaceUsage = spaceLeft;
                    bestAtlas = atlas;
                }
            }
        });

        return bestAtlas;
    }

    /**
     * 添加到现有图集
     */
    private async addToExistingAtlas(
        atlasName: string,
        svgContent: string,
        width: number,
        height: number,
        color?: string
    ): Promise<boolean> {
        const atlas = this.atlases.get(atlasName);
        if (!atlas) return false;

        try {
            // 这里应该实现实际的图集更新逻辑
            // 简化实现：重新构建整个图集
            const allEntries = Array.from(atlas.svgEntries.values()).map((entry) => ({
                content: entry.svgContent,
                width: entry.size.x,
                height: entry.size.y,
                color: this.extractColorFromSVG(entry.svgContent),
            }));

            // 添加新条目
            allEntries.push({
                content: svgContent,
                width,
                height,
                color,
            });

            // 重新构建图集
            const newAtlas = await this.createAtlas(`${atlasName}_updated`, allEntries);
            if (newAtlas) {
                // 替换旧图集
                this.clearAtlas(atlasName);
                this.atlases.set(`${atlasName}_updated`, newAtlas);

                // 更新映射
                const key = this.generateSVGKey(svgContent, width, height, color);
                this.svgToAtlasMapping.set(key, {
                    atlasName: `${atlasName}_updated`,
                    entryKey: key,
                });

                return true;
            }

            return false;
        } catch (error) {
            console.error("添加到现有图集失败:", error);
            return false;
        }
    }

    /**
     * 从SVG提取颜色
     */
    private extractColorFromSVG(svgContent: string): string | undefined {
        const colorMatch = svgContent.match(/fill="([^"]*)"/);
        if (colorMatch && colorMatch[1] !== "none" && colorMatch[1] !== "transparent") {
            return colorMatch[1];
        }
        return undefined;
    }

    /**
     * 创建图集
     */
    private async createAtlas(
        name: string,
        svgContents: Array<{
            content: string;
            width: number;
            height: number;
            color?: string;
        }>
    ): Promise<AtlasData | null> {
        if (svgContents.length === 0) return null;

        try {
            // 计算图集尺寸
            const atlasSize = this.calculateAtlasSize(svgContents);
            if (atlasSize.width === 0 || atlasSize.height === 0) {
                return null;
            }

            // 创建Canvas
            const canvas = document.createElement("canvas");
            canvas.width = atlasSize.width;
            canvas.height = atlasSize.height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                throw new Error("无法获取Canvas 2D上下文");
            }

            // 清空画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 矩形包装算法（简化：简单网格布局）
            const entries = new Map<string, AtlasEntry>();
            const cellSize = this.calculateCellSize(svgContents);
            const cols = Math.floor(atlasSize.width / cellSize);
            const rows = Math.ceil(svgContents.length / cols);

            let index = 0;
            for (const svg of svgContents) {
                if (index >= cols * rows) break;

                const col = index % cols;
                const row = Math.floor(index / cols);

                const x = col * cellSize + this.padding;
                const y = row * cellSize + this.padding;
                const entryWidth = cellSize - this.padding * 2;
                const entryHeight = cellSize - this.padding * 2;

                // 获取SVG精灵帧
                const spriteFrame = await SVGSpriteCache.getSVGSpriteFrame(svg.content, entryWidth, entryHeight, svg.color);

                // 这里应该将SVG绘制到Canvas的对应位置
                // 简化实现：绘制一个占位矩形
                ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
                ctx.fillRect(x, y, entryWidth, entryHeight);

                // 创建图集条目
                const entryKey = this.generateSVGKey(svg.content, svg.width, svg.height, svg.color);
                entries.set(entryKey, {
                    svgContent: svg.content,
                    uvRect: new Rect(
                        x / atlasSize.width,
                        y / atlasSize.height,
                        entryWidth / atlasSize.width,
                        entryHeight / atlasSize.height
                    ),
                    pixelRect: new Rect(x, y, entryWidth, entryHeight),
                    size: new Vec2(svg.width, svg.height),
                });

                index++;
            }

            // 创建纹理
            const imageAsset = new ImageAsset(canvas);
            const texture = new Texture2D();
            texture.image = imageAsset;

            // 创建精灵帧
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;

            // 计算空间使用率
            const totalCells = cols * rows;
            const usedCells = Math.min(svgContents.length, totalCells);
            const usedSpace = (usedCells * cellSize * cellSize) / (atlasSize.width * atlasSize.height);

            return {
                name,
                texture,
                spriteFrame,
                svgEntries: entries,
                usedSpace,
                width: atlasSize.width,
                height: atlasSize.height,
            };
        } catch (error) {
            console.error("创建图集失败:", error);
            return null;
        }
    }

    /**
     * 计算图集尺寸
     */
    private calculateAtlasSize(
        svgContents: Array<{
            content: string;
            width: number;
            height: number;
            color?: string;
        }>
    ): { width: number; height: number } {
        if (svgContents.length === 0) {
            return { width: 0, height: 0 };
        }

        // 简单计算：基于SVG数量和最大尺寸
        const maxWidth = Math.max(...svgContents.map((svg) => svg.width));
        const maxHeight = Math.max(...svgContents.map((svg) => svg.height));

        // 计算网格布局
        const cellSize = Math.max(maxWidth, maxHeight) + this.padding * 2;
        const svgCount = svgContents.length;

        // 估算所需行列
        const estimatedCells = svgCount;
        const side = Math.ceil(Math.sqrt(estimatedCells));

        let width = Math.min(side * cellSize, this.maxAtlasWidth);
        let height = Math.min(side * cellSize, this.maxAtlasHeight);

        // 确保尺寸是2的幂（纹理优化）
        width = this.nextPowerOfTwo(width);
        height = this.nextPowerOfTwo(height);

        return { width, height };
    }

    /**
     * 计算单元格尺寸
     */
    private calculateCellSize(
        svgContents: Array<{
            content: string;
            width: number;
            height: number;
            color?: string;
        }>
    ): number {
        if (svgContents.length === 0) return 0;

        // 找到最大尺寸并加上padding
        const maxWidth = Math.max(...svgContents.map((svg) => svg.width));
        const maxHeight = Math.max(...svgContents.map((svg) => svg.height));
        const maxSize = Math.max(maxWidth, maxHeight);

        return maxSize + this.padding * 2;
    }

    /**
     * 下一个2的幂
     */
    private nextPowerOfTwo(n: number): number {
        n--;
        n |= n >> 1;
        n |= n >> 2;
        n |= n >> 4;
        n |= n >> 8;
        n |= n >> 16;
        n++;
        return Math.min(Math.max(n, 64), this.maxAtlasWidth);
    }

    /**
     * 合并或替换图集
     */
    private async mergeOrReplaceAtlas(
        svgContents: Array<{
            content: string;
            width: number;
            height: number;
            color?: string;
        }>
    ): Promise<AtlasData | null> {
        // 找到使用率最低的图集
        let lowestUsageAtlas: { name: string; usage: number } | null = null;

        this.atlases.forEach((atlas, name) => {
            if (!lowestUsageAtlas || atlas.usedSpace < lowestUsageAtlas.usage) {
                lowestUsageAtlas = { name: name, usage: atlas.usedSpace };
            }
        });

        if (lowestUsageAtlas) {
            // 清除使用率最低的图集
            this.clearAtlas((lowestUsageAtlas as { name: string; usage: number }).name);

            // 创建新图集
            return this.buildAtlas(svgContents);
        }

        return null;
    }

    /**
     * 优化指定图集
     */
    private async optimizeAtlas(atlasName: string): Promise<void> {
        const atlas = this.atlases.get(atlasName);
        if (!atlas) return;

        // 收集所有条目
        const allEntries = Array.from(atlas.svgEntries.values()).map((entry) => ({
            content: entry.svgContent,
            width: entry.size.x,
            height: entry.size.y,
            color: this.extractColorFromSVG(entry.svgContent),
        }));

        // 重新构建图集（可能更紧凑）
        const optimizedAtlas = await this.createAtlas(`${atlasName}_optimized`, allEntries);
        if (optimizedAtlas && optimizedAtlas.usedSpace > atlas.usedSpace) {
            // 替换旧图集
            this.clearAtlas(atlasName);
            this.atlases.set(`${atlasName}_optimized`, optimizedAtlas);

            // 更新映射
            optimizedAtlas.svgEntries.forEach((entry, key) => {
                this.svgToAtlasMapping.set(key, {
                    atlasName: `${atlasName}_optimized`,
                    entryKey: key,
                });
            });

            console.log(`图集优化完成: ${atlasName} -> ${atlasName}_optimized`);
        }
    }
}
