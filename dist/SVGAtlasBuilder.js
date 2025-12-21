"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGAtlasBuilder = void 0;
const cc_1 = require("cc");
const { ccclass, property, executeInEditMode, menu } = cc_1._decorator;
const SVGSpriteCache_1 = require("./SVGSpriteCache");
/**
 * SVG图集构建器
 * 将多个SVG打包到单个纹理图集中，减少纹理切换开销
 */
let SVGAtlasBuilder = class SVGAtlasBuilder extends cc_1.Component {
    constructor() {
        // ========== 图集配置 ==========
        super(...arguments);
        this.maxAtlasWidth = 1024;
        this.maxAtlasHeight = 1024;
        this.padding = 2;
        this.enableAutoAtlas = true;
        this.buildThreshold = 10;
        // ========== 性能配置 ==========
        this.enableRuntimeUpdates = false;
        this.maxAtlases = 3;
        // ========== 内部状态 ==========
        this.atlases = new Map(); // 图集名称 -> 图集数据
        this.svgToAtlasMapping = new Map(); // SVG内容 -> 图集映射
        this.pendingSVGs = new Set(); // 待处理SVG
    }
    // ========== 生命周期方法 ==========
    onLoad() {
        this.initializeAtlasBuilder();
    }
    onDestroy() {
        this.cleanupAtlasBuilder();
    }
    update(deltaTime) {
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
    addSVGToAtlas(svgContent, width, height, color) {
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
    async getSVGFromAtlas(svgContent, width, height, color) {
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
    async buildAtlas(svgContents) {
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
        }
        catch (error) {
            console.error("构建图集失败:", error);
            return null;
        }
    }
    /**
     * 获取所有图集信息
     */
    getAllAtlasInfo() {
        const info = [];
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
    clearAtlas(atlasName) {
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
    clearAllAtlases() {
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
    async optimizeAtlases() {
        const optimizationPromises = [];
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
    initializeAtlasBuilder() {
        this.atlases.clear();
        this.svgToAtlasMapping.clear();
        this.pendingSVGs.clear();
        console.log("SVGAtlasBuilder 初始化完成");
    }
    /**
     * 清理图集构建器
     */
    cleanupAtlasBuilder() {
        this.clearAllAtlases();
        console.log("SVGAtlasBuilder 清理完成");
    }
    /**
     * 生成SVG键
     */
    generateSVGKey(svgContent, width, height, color) {
        const colorPart = color || "default";
        const hash = this.calculateSimpleHash(svgContent);
        return `${hash}_${width}x${height}_${colorPart}`;
    }
    /**
     * 计算简单哈希
     */
    calculateSimpleHash(str) {
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
    async processPendingSVGs() {
        if (this.pendingSVGs.size === 0)
            return;
        // 收集待处理SVG的详细信息
        const svgDetails = [];
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
    async addSVGToAtlasAndBuild(svgContent, width, height, color) {
        const key = this.generateSVGKey(svgContent, width, height, color);
        // 检查是否有空间足够的现有图集
        const suitableAtlas = this.findSuitableAtlas(width, height);
        if (suitableAtlas) {
            await this.addToExistingAtlas(suitableAtlas.name, svgContent, width, height, color);
        }
        else {
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
    findSuitableAtlas(width, height) {
        let bestAtlas = null;
        let bestSpaceUsage = Infinity;
        this.atlases.forEach((atlas) => {
            // 检查图集是否有足够空间
            if (atlas.usedSpace < 0.9 && // 使用率低于90%
                width <= atlas.width * (1 - atlas.usedSpace) &&
                height <= atlas.height * (1 - atlas.usedSpace)) {
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
    async addToExistingAtlas(atlasName, svgContent, width, height, color) {
        const atlas = this.atlases.get(atlasName);
        if (!atlas)
            return false;
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
        }
        catch (error) {
            console.error("添加到现有图集失败:", error);
            return false;
        }
    }
    /**
     * 从SVG提取颜色
     */
    extractColorFromSVG(svgContent) {
        const colorMatch = svgContent.match(/fill="([^"]*)"/);
        if (colorMatch && colorMatch[1] !== "none" && colorMatch[1] !== "transparent") {
            return colorMatch[1];
        }
        return undefined;
    }
    /**
     * 创建图集
     */
    async createAtlas(name, svgContents) {
        if (svgContents.length === 0)
            return null;
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
            const entries = new Map();
            const cellSize = this.calculateCellSize(svgContents);
            const cols = Math.floor(atlasSize.width / cellSize);
            const rows = Math.ceil(svgContents.length / cols);
            let index = 0;
            for (const svg of svgContents) {
                if (index >= cols * rows)
                    break;
                const col = index % cols;
                const row = Math.floor(index / cols);
                const x = col * cellSize + this.padding;
                const y = row * cellSize + this.padding;
                const entryWidth = cellSize - this.padding * 2;
                const entryHeight = cellSize - this.padding * 2;
                // 获取SVG精灵帧
                const spriteFrame = await SVGSpriteCache_1.SVGSpriteCache.getSVGSpriteFrame(svg.content, entryWidth, entryHeight, svg.color);
                // 这里应该将SVG绘制到Canvas的对应位置
                // 简化实现：绘制一个占位矩形
                ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
                ctx.fillRect(x, y, entryWidth, entryHeight);
                // 创建图集条目
                const entryKey = this.generateSVGKey(svg.content, svg.width, svg.height, svg.color);
                entries.set(entryKey, {
                    svgContent: svg.content,
                    uvRect: new cc_1.Rect(x / atlasSize.width, y / atlasSize.height, entryWidth / atlasSize.width, entryHeight / atlasSize.height),
                    pixelRect: new cc_1.Rect(x, y, entryWidth, entryHeight),
                    size: new cc_1.Vec2(svg.width, svg.height),
                });
                index++;
            }
            // 创建纹理
            const imageAsset = new cc_1.ImageAsset(canvas);
            const texture = new cc_1.Texture2D();
            texture.image = imageAsset;
            // 创建精灵帧
            const spriteFrame = new cc_1.SpriteFrame();
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
        }
        catch (error) {
            console.error("创建图集失败:", error);
            return null;
        }
    }
    /**
     * 计算图集尺寸
     */
    calculateAtlasSize(svgContents) {
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
    calculateCellSize(svgContents) {
        if (svgContents.length === 0)
            return 0;
        // 找到最大尺寸并加上padding
        const maxWidth = Math.max(...svgContents.map((svg) => svg.width));
        const maxHeight = Math.max(...svgContents.map((svg) => svg.height));
        const maxSize = Math.max(maxWidth, maxHeight);
        return maxSize + this.padding * 2;
    }
    /**
     * 下一个2的幂
     */
    nextPowerOfTwo(n) {
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
    async mergeOrReplaceAtlas(svgContents) {
        // 找到使用率最低的图集
        let lowestUsageAtlas = null;
        this.atlases.forEach((atlas, name) => {
            if (!lowestUsageAtlas || atlas.usedSpace < lowestUsageAtlas.usage) {
                lowestUsageAtlas = { name: name, usage: atlas.usedSpace };
            }
        });
        if (lowestUsageAtlas) {
            // 清除使用率最低的图集
            this.clearAtlas(lowestUsageAtlas.name);
            // 创建新图集
            return this.buildAtlas(svgContents);
        }
        return null;
    }
    /**
     * 优化指定图集
     */
    async optimizeAtlas(atlasName) {
        const atlas = this.atlases.get(atlasName);
        if (!atlas)
            return;
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
};
exports.SVGAtlasBuilder = SVGAtlasBuilder;
__decorate([
    property({
        tooltip: "图集最大宽度",
        displayName: "最大宽度",
        min: 64,
        max: 4096,
    })
], SVGAtlasBuilder.prototype, "maxAtlasWidth", void 0);
__decorate([
    property({
        tooltip: "图集最大高度",
        displayName: "最大高度",
        min: 64,
        max: 4096,
    })
], SVGAtlasBuilder.prototype, "maxAtlasHeight", void 0);
__decorate([
    property({
        tooltip: "纹理间距（像素）",
        displayName: "纹理间距",
        min: 0,
        max: 32,
    })
], SVGAtlasBuilder.prototype, "padding", void 0);
__decorate([
    property({
        tooltip: "启用自动图集构建",
        displayName: "自动构建",
    })
], SVGAtlasBuilder.prototype, "enableAutoAtlas", void 0);
__decorate([
    property({
        tooltip: "图集构建阈值（SVG数量）",
        displayName: "构建阈值",
        min: 2,
        max: 100,
    })
], SVGAtlasBuilder.prototype, "buildThreshold", void 0);
__decorate([
    property({
        tooltip: "启用运行时图集更新",
        displayName: "运行时更新",
    })
], SVGAtlasBuilder.prototype, "enableRuntimeUpdates", void 0);
__decorate([
    property({
        tooltip: "最大图集数量",
        displayName: "最大图集数",
        min: 1,
        max: 10,
    })
], SVGAtlasBuilder.prototype, "maxAtlases", void 0);
exports.SVGAtlasBuilder = SVGAtlasBuilder = __decorate([
    ccclass("SVGAtlasBuilder"),
    menu("2D/SVGAtlasBuilder"),
    executeInEditMode
], SVGAtlasBuilder);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHQXRsYXNCdWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc291cmNlL1NWR0F0bGFzQnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSwyQkFBMkY7QUFDM0YsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBVSxDQUFDO0FBRWxFLHFEQUFrRDtBQWlDbEQ7OztHQUdHO0FBSUksSUFBTSxlQUFlLEdBQXJCLE1BQU0sZUFBZ0IsU0FBUSxjQUFTO0lBQXZDO1FBQ0gsNkJBQTZCOztRQVFyQixrQkFBYSxHQUFXLElBQUksQ0FBQztRQVE3QixtQkFBYyxHQUFXLElBQUksQ0FBQztRQVE5QixZQUFPLEdBQVcsQ0FBQyxDQUFDO1FBTXBCLG9CQUFlLEdBQVksSUFBSSxDQUFDO1FBUWhDLG1CQUFjLEdBQVcsRUFBRSxDQUFDO1FBRXBDLDZCQUE2QjtRQU1yQix5QkFBb0IsR0FBWSxLQUFLLENBQUM7UUFRdEMsZUFBVSxHQUFXLENBQUMsQ0FBQztRQUUvQiw2QkFBNkI7UUFFckIsWUFBTyxHQUEyQixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsZUFBZTtRQUM1RCxzQkFBaUIsR0FBOEIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQjtRQUMxRSxnQkFBVyxHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsU0FBUztJQTRvQjNELENBQUM7SUExb0JHLCtCQUErQjtJQUUvQixNQUFNO1FBQ0YsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUVELFNBQVM7UUFDTCxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztJQUMvQixDQUFDO0lBRUQsTUFBTSxDQUFDLFNBQWlCO1FBQ3BCLElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFF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LFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxVQUFVO1FBQ25CLFdBQVcsRUFBRSxNQUFNO1FBQ25CLEdBQUcsRUFBRSxDQUFDO1FBQ04sR0FBRyxFQUFFLEVBQUU7S0FDVixDQUFDO2dEQUMwQjtBQU1wQjtJQUpQLFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxVQUFVO1FBQ25CLFdBQVcsRUFBRSxNQUFNO0tBQ3RCLENBQUM7d0RBQ3NDO0FBUWhDO0lBTlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLGVBQWU7UUFDeEIsV0FBVyxFQUFFLE1BQU07UUFDbkIsR0FBRyxFQUFFLENBQUM7UUFDTixHQUFHLEVBQUUsR0FBRztLQUNYLENBQUM7dURBQ2tDO0FBUTVCO0lBSlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLFdBQVc7UUFDcEIsV0FBVyxFQUFFLE9BQU87S0FDdkIsQ0FBQzs2REFDNEM7QUFRdEM7SUFOUCxRQUFRLENBQUM7UUFDTixPQUFPLEVBQUUsUUFBUTtRQUNqQixXQUFXLEVBQUUsT0FBTztRQUNwQixHQUFHLEVBQUUsQ0FBQztRQUNOLEdBQUcsRUFBRSxFQUFFO0tBQ1YsQ0FBQzttREFDNkI7MEJBdkR0QixlQUFlO0lBSDNCLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztJQUMxQixJQUFJLENBQUMsb0JBQW9CLENBQUM7SUFDMUIsaUJBQWlCO0dBQ0wsZUFBZSxDQXlzQjNCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgX2RlY29yYXRvciwgQ29tcG9uZW50LCBTcHJpdGVGcmFtZSwgVGV4dHVyZTJELCBJbWFnZUFzc2V0LCBSZWN0LCBWZWMyIH0gZnJvbSBcImNjXCI7XHJcbmNvbnN0IHsgY2NjbGFzcywgcHJvcGVydHksIGV4ZWN1dGVJbkVkaXRNb2RlLCBtZW51IH0gPSBfZGVjb3JhdG9yO1xyXG5cclxuaW1wb3J0IHsgU1ZHU3ByaXRlQ2FjaGUgfSBmcm9tIFwiLi9TVkdTcHJpdGVDYWNoZVwiO1xyXG5cclxuLyoqXHJcbiAqIOWbvumbhuadoeebruaOpeWPo1xyXG4gKi9cclxuaW50ZXJmYWNlIEF0bGFzRW50cnkge1xyXG4gICAgc3ZnQ29udGVudDogc3RyaW5nO1xyXG4gICAgdXZSZWN0OiBSZWN0OyAvLyBVVuWdkOagh++8iDAtMeiMg+WbtO+8iVxyXG4gICAgcGl4ZWxSZWN0OiBSZWN0OyAvLyDlg4/ntKDlnZDmoIdcclxuICAgIHNpemU6IFZlYzI7IC8vIOWOn+Wni+WwuuWvuFxyXG59XHJcblxyXG4vKipcclxuICog5Zu+6ZuG5pig5bCE5o6l5Y+jXHJcbiAqL1xyXG5pbnRlcmZhY2UgQXRsYXNNYXBwaW5nIHtcclxuICAgIGF0bGFzTmFtZTogc3RyaW5nO1xyXG4gICAgZW50cnlLZXk6IHN0cmluZztcclxufVxyXG5cclxuLyoqXHJcbiAqIOWbvumbhuaVsOaNruaOpeWPo1xyXG4gKi9cclxuaW50ZXJmYWNlIEF0bGFzRGF0YSB7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICB0ZXh0dXJlOiBUZXh0dXJlMkQ7XHJcbiAgICBzcHJpdGVGcmFtZTogU3ByaXRlRnJhbWU7XHJcbiAgICBzdmdFbnRyaWVzOiBNYXA8c3RyaW5nLCBBdGxhc0VudHJ5PjtcclxuICAgIHVzZWRTcGFjZTogbnVtYmVyOyAvLyDlt7Lkvb/nlKjnqbrpl7Tmr5TkvovvvIgwLTHvvIlcclxuICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICBoZWlnaHQ6IG51bWJlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNWR+WbvumbhuaehOW7uuWZqFxyXG4gKiDlsIblpJrkuKpTVkfmiZPljIXliLDljZXkuKrnurnnkIblm77pm4bkuK3vvIzlh4/lsJHnurnnkIbliIfmjaLlvIDplIBcclxuICovXHJcbkBjY2NsYXNzKFwiU1ZHQXRsYXNCdWlsZGVyXCIpXHJcbkBtZW51KFwiMkQvU1ZHQXRsYXNCdWlsZGVyXCIpXHJcbkBleGVjdXRlSW5FZGl0TW9kZVxyXG5leHBvcnQgY2xhc3MgU1ZHQXRsYXNCdWlsZGVyIGV4dGVuZHMgQ29tcG9uZW50IHtcclxuICAgIC8vID09PT09PT09PT0g5Zu+6ZuG6YWN572uID09PT09PT09PT1cclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwi5Zu+6ZuG5pyA5aSn5a695bqmXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5pyA5aSn5a695bqmXCIsXHJcbiAgICAgICAgbWluOiA2NCxcclxuICAgICAgICBtYXg6IDQwOTYsXHJcbiAgICB9KVxyXG4gICAgcHJpdmF0ZSBtYXhBdGxhc1dpZHRoOiBudW1iZXIgPSAxMDI0O1xyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCLlm77pm4bmnIDlpKfpq5jluqZcIixcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLmnIDlpKfpq5jluqZcIixcclxuICAgICAgICBtaW46IDY0LFxyXG4gICAgICAgIG1heDogNDA5NixcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIG1heEF0bGFzSGVpZ2h0OiBudW1iZXIgPSAxMDI0O1xyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCLnurnnkIbpl7Tot53vvIjlg4/ntKDvvIlcIixcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLnurnnkIbpl7Tot51cIixcclxuICAgICAgICBtaW46IDAsXHJcbiAgICAgICAgbWF4OiAzMixcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIHBhZGRpbmc6IG51bWJlciA9IDI7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuWQr+eUqOiHquWKqOWbvumbhuaehOW7ulwiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuiHquWKqOaehOW7ulwiLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgZW5hYmxlQXV0b0F0bGFzOiBib29sZWFuID0gdHJ1ZTtcclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwi5Zu+6ZuG5p6E5bu66ZiI5YC877yIU1ZH5pWw6YeP77yJXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5p6E5bu66ZiI5YC8XCIsXHJcbiAgICAgICAgbWluOiAyLFxyXG4gICAgICAgIG1heDogMTAwLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgYnVpbGRUaHJlc2hvbGQ6IG51bWJlciA9IDEwO1xyXG5cclxuICAgIC8vID09PT09PT09PT0g5oCn6IO96YWN572uID09PT09PT09PT1cclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwi5ZCv55So6L+Q6KGM5pe25Zu+6ZuG5pu05pawXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi6L+Q6KGM5pe25pu05pawXCIsXHJcbiAgICB9KVxyXG4gICAgcHJpdmF0ZSBlbmFibGVSdW50aW1lVXBkYXRlczogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCLmnIDlpKflm77pm4bmlbDph49cIixcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLmnIDlpKflm77pm4bmlbBcIixcclxuICAgICAgICBtaW46IDEsXHJcbiAgICAgICAgbWF4OiAxMCxcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIG1heEF0bGFzZXM6IG51bWJlciA9IDM7XHJcblxyXG4gICAgLy8gPT09PT09PT09PSDlhoXpg6jnirbmgIEgPT09PT09PT09PVxyXG5cclxuICAgIHByaXZhdGUgYXRsYXNlczogTWFwPHN0cmluZywgQXRsYXNEYXRhPiA9IG5ldyBNYXAoKTsgLy8g5Zu+6ZuG5ZCN56ewIC0+IOWbvumbhuaVsOaNrlxyXG4gICAgcHJpdmF0ZSBzdmdUb0F0bGFzTWFwcGluZzogTWFwPHN0cmluZywgQXRsYXNNYXBwaW5nPiA9IG5ldyBNYXAoKTsgLy8gU1ZH5YaF5a65IC0+IOWbvumbhuaYoOWwhFxyXG4gICAgcHJpdmF0ZSBwZW5kaW5nU1ZHczogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7IC8vIOW+heWkhOeQhlNWR1xyXG5cclxuICAgIC8vID09PT09PT09PT0g55Sf5ZG95ZGo5pyf5pa55rOVID09PT09PT09PT1cclxuXHJcbiAgICBvbkxvYWQoKSB7XHJcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQXRsYXNCdWlsZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgb25EZXN0cm95KCkge1xyXG4gICAgICAgIHRoaXMuY2xlYW51cEF0bGFzQnVpbGRlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZShkZWx0YVRpbWU6IG51bWJlcikge1xyXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZUF1dG9BdGxhcyAmJiB0aGlzLnBlbmRpbmdTVkdzLnNpemUgPj0gdGhpcy5idWlsZFRocmVzaG9sZCkge1xyXG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NQZW5kaW5nU1ZHcygpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyA9PT09PT09PT09IOWFrOWFseaWueazlSA9PT09PT09PT09XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmt7vliqBTVkfliLDlm77pm4bmnoTlu7rpmJ/liJdcclxuICAgICAqIEBwYXJhbSBzdmdDb250ZW50IFNWR+WGheWuuVxyXG4gICAgICogQHBhcmFtIHdpZHRoIOWuveW6plxyXG4gICAgICogQHBhcmFtIGhlaWdodCDpq5jluqZcclxuICAgICAqIEBwYXJhbSBjb2xvciDpopzoibLvvIjlj6/pgInvvIlcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFkZFNWR1RvQXRsYXMoc3ZnQ29udGVudDogc3RyaW5nLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgY29sb3I/OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmdlbmVyYXRlU1ZHS2V5KHN2Z0NvbnRlbnQsIHdpZHRoLCBoZWlnaHQsIGNvbG9yKTtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLnN2Z1RvQXRsYXNNYXBwaW5nLmhhcyhrZXkpKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGVuZGluZ1NWR3MuYWRkKGtleSk7XHJcblxyXG4gICAgICAgICAgICAvLyDlpoLmnpzlkK/nlKjkuoboh6rliqjmnoTlu7rkuJTovr7liLDpmIjlgLzvvIznq4vljbPlpITnkIZcclxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlQXV0b0F0bGFzICYmIHRoaXMucGVuZGluZ1NWR3Muc2l6ZSA+PSB0aGlzLmJ1aWxkVGhyZXNob2xkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NQZW5kaW5nU1ZHcygpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+WU1ZH55qE5Zu+6ZuG57K+54G15binXHJcbiAgICAgKiBAcGFyYW0gc3ZnQ29udGVudCBTVkflhoXlrrlcclxuICAgICAqIEBwYXJhbSB3aWR0aCDlrr3luqZcclxuICAgICAqIEBwYXJhbSBoZWlnaHQg6auY5bqmXHJcbiAgICAgKiBAcGFyYW0gY29sb3Ig6aKc6Imy77yI5Y+v6YCJ77yJXHJcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlPFNwcml0ZUZyYW1lPiDov5Tlm57lm77pm4bkuK3nmoTnsr7ngbXluKdcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFzeW5jIGdldFNWR0Zyb21BdGxhcyhzdmdDb250ZW50OiBzdHJpbmcsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBjb2xvcj86IHN0cmluZyk6IFByb21pc2U8U3ByaXRlRnJhbWUgfCBudWxsPiB7XHJcbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5nZW5lcmF0ZVNWR0tleShzdmdDb250ZW50LCB3aWR0aCwgaGVpZ2h0LCBjb2xvcik7XHJcblxyXG4gICAgICAgIC8vIOajgOafpeaYr+WQpuW3suWcqOWbvumbhuS4rVxyXG4gICAgICAgIGNvbnN0IG1hcHBpbmcgPSB0aGlzLnN2Z1RvQXRsYXNNYXBwaW5nLmdldChrZXkpO1xyXG4gICAgICAgIGlmIChtYXBwaW5nKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGF0bGFzID0gdGhpcy5hdGxhc2VzLmdldChtYXBwaW5nLmF0bGFzTmFtZSk7XHJcbiAgICAgICAgICAgIGlmIChhdGxhcykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF0bGFzLnNwcml0ZUZyYW1lO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDlpoLmnpzkuI3lnKjlm77pm4bkuK3kuJTlkK/nlKjkuobov5DooYzml7bmm7TmlrDvvIzlsJ3or5Xmt7vliqDliLDlm77pm4ZcclxuICAgICAgICBpZiAodGhpcy5lbmFibGVSdW50aW1lVXBkYXRlcykge1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFkZFNWR1RvQXRsYXNBbmRCdWlsZChzdmdDb250ZW50LCB3aWR0aCwgaGVpZ2h0LCBjb2xvcik7XHJcblxyXG4gICAgICAgICAgICAvLyDph43mlrDmo4Dmn6VcclxuICAgICAgICAgICAgY29uc3QgbmV3TWFwcGluZyA9IHRoaXMuc3ZnVG9BdGxhc01hcHBpbmcuZ2V0KGtleSk7XHJcbiAgICAgICAgICAgIGlmIChuZXdNYXBwaW5nKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBhdGxhcyA9IHRoaXMuYXRsYXNlcy5nZXQobmV3TWFwcGluZy5hdGxhc05hbWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGF0bGFzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGF0bGFzLnNwcml0ZUZyYW1lO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOaJi+WKqOaehOW7uuWbvumbhlxyXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnRzIFNWR+WGheWuueaVsOe7hO+8iOW4puWwuuWvuOWSjOminOiJsu+8iVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXN5bmMgYnVpbGRBdGxhcyhcclxuICAgICAgICBzdmdDb250ZW50czogQXJyYXk8e1xyXG4gICAgICAgICAgICBjb250ZW50OiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgICAgICAgICBjb2xvcj86IHN0cmluZztcclxuICAgICAgICB9PlxyXG4gICAgKTogUHJvbWlzZTxBdGxhc0RhdGEgfCBudWxsPiB7XHJcbiAgICAgICAgaWYgKHN2Z0NvbnRlbnRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCLmsqHmnIlTVkflhoXlrrnlj6/mnoTlu7rlm77pm4ZcIik7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8g5qOA5p+l5Zu+6ZuG5pWw6YeP6ZmQ5Yi2XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmF0bGFzZXMuc2l6ZSA+PSB0aGlzLm1heEF0bGFzZXMpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIuW3sui+vuWIsOacgOWkp+WbvumbhuaVsOmHj+mZkOWItlwiKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1lcmdlT3JSZXBsYWNlQXRsYXMoc3ZnQ29udGVudHMpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDliJvlu7rmlrDlm77pm4ZcclxuICAgICAgICAgICAgY29uc3QgYXRsYXNOYW1lID0gYGF0bGFzXyR7RGF0ZS5ub3coKX1gO1xyXG4gICAgICAgICAgICBjb25zdCBhdGxhc0RhdGEgPSBhd2FpdCB0aGlzLmNyZWF0ZUF0bGFzKGF0bGFzTmFtZSwgc3ZnQ29udGVudHMpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGF0bGFzRGF0YSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hdGxhc2VzLnNldChhdGxhc05hbWUsIGF0bGFzRGF0YSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g5pu05paw5pig5bCEXHJcbiAgICAgICAgICAgICAgICBzdmdDb250ZW50cy5mb3JFYWNoKChzdmcpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmdlbmVyYXRlU1ZHS2V5KHN2Zy5jb250ZW50LCBzdmcud2lkdGgsIHN2Zy5oZWlnaHQsIHN2Zy5jb2xvcik7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdmdUb0F0bGFzTWFwcGluZy5zZXQoa2V5LCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0bGFzTmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZW50cnlLZXk6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDlm77pm4bmnoTlu7rlrozmiJA6ICR7YXRsYXNOYW1lfSwg5YyF5ZCrICR7c3ZnQ29udGVudHMubGVuZ3RofSDkuKpTVkdgKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBhdGxhc0RhdGE7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCLmnoTlu7rlm77pm4blpLHotKU6XCIsIGVycm9yKTtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W5omA5pyJ5Zu+6ZuG5L+h5oGvXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBnZXRBbGxBdGxhc0luZm8oKTogQXJyYXk8e1xyXG4gICAgICAgIG5hbWU6IHN0cmluZztcclxuICAgICAgICBzdmdDb3VudDogbnVtYmVyO1xyXG4gICAgICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICAgICAgaGVpZ2h0OiBudW1iZXI7XHJcbiAgICAgICAgdXNlZFNwYWNlOiBudW1iZXI7XHJcbiAgICB9PiB7XHJcbiAgICAgICAgY29uc3QgaW5mbzogQXJyYXk8e1xyXG4gICAgICAgICAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHN2Z0NvdW50OiBudW1iZXI7XHJcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgICAgICAgICB1c2VkU3BhY2U6IG51bWJlcjtcclxuICAgICAgICB9PiA9IFtdO1xyXG5cclxuICAgICAgICB0aGlzLmF0bGFzZXMuZm9yRWFjaCgoYXRsYXMsIG5hbWUpID0+IHtcclxuICAgICAgICAgICAgaW5mby5wdXNoKHtcclxuICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgICAgICBzdmdDb3VudDogYXRsYXMuc3ZnRW50cmllcy5zaXplLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IGF0bGFzLndpZHRoLFxyXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBhdGxhcy5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICB1c2VkU3BhY2U6IGF0bGFzLnVzZWRTcGFjZSxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBpbmZvO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5riF6Zmk5oyH5a6a5Zu+6ZuGXHJcbiAgICAgKiBAcGFyYW0gYXRsYXNOYW1lIOWbvumbhuWQjeensFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgY2xlYXJBdGxhcyhhdGxhc05hbWU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IGF0bGFzID0gdGhpcy5hdGxhc2VzLmdldChhdGxhc05hbWUpO1xyXG4gICAgICAgIGlmIChhdGxhcykge1xyXG4gICAgICAgICAgICAvLyDph4rmlL7nurnnkIbotYTmupBcclxuICAgICAgICAgICAgaWYgKGF0bGFzLnRleHR1cmUpIHtcclxuICAgICAgICAgICAgICAgIGF0bGFzLnRleHR1cmUuZGVzdHJveSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDnp7vpmaTmmKDlsIRcclxuICAgICAgICAgICAgYXRsYXMuc3ZnRW50cmllcy5mb3JFYWNoKChlbnRyeSwga2V5KSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN2Z1RvQXRsYXNNYXBwaW5nLmRlbGV0ZShrZXkpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIOenu+mZpOWbvumbhlxyXG4gICAgICAgICAgICB0aGlzLmF0bGFzZXMuZGVsZXRlKGF0bGFzTmFtZSk7XHJcblxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhg5bey5riF6Zmk5Zu+6ZuGOiAke2F0bGFzTmFtZX1gKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmuIXpmaTmiYDmnInlm77pm4ZcclxuICAgICAqL1xyXG4gICAgcHVibGljIGNsZWFyQWxsQXRsYXNlcygpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmF0bGFzZXMuZm9yRWFjaCgoYXRsYXMsIG5hbWUpID0+IHtcclxuICAgICAgICAgICAgaWYgKGF0bGFzLnRleHR1cmUpIHtcclxuICAgICAgICAgICAgICAgIGF0bGFzLnRleHR1cmUuZGVzdHJveSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuYXRsYXNlcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMuc3ZnVG9BdGxhc01hcHBpbmcuY2xlYXIoKTtcclxuICAgICAgICB0aGlzLnBlbmRpbmdTVkdzLmNsZWFyKCk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKFwi5bey5riF6Zmk5omA5pyJ5Zu+6ZuGXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5LyY5YyW5Zu+6ZuG56m66Ze05L2/55SoXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhc3luYyBvcHRpbWl6ZUF0bGFzZXMoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgY29uc3Qgb3B0aW1pemF0aW9uUHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xyXG5cclxuICAgICAgICB0aGlzLmF0bGFzZXMuZm9yRWFjaCgoYXRsYXMsIG5hbWUpID0+IHtcclxuICAgICAgICAgICAgaWYgKGF0bGFzLnVzZWRTcGFjZSA8IDAuNikge1xyXG4gICAgICAgICAgICAgICAgLy8g56m66Ze05L2/55So546H5L2O5LqONjAlXHJcbiAgICAgICAgICAgICAgICBvcHRpbWl6YXRpb25Qcm9taXNlcy5wdXNoKHRoaXMub3B0aW1pemVBdGxhcyhuYW1lKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwob3B0aW1pemF0aW9uUHJvbWlzZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vID09PT09PT09PT0g56eB5pyJ5pa55rOVID09PT09PT09PT1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIneWni+WMluWbvumbhuaehOW7uuWZqFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGluaXRpYWxpemVBdGxhc0J1aWxkZXIoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5hdGxhc2VzLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy5zdmdUb0F0bGFzTWFwcGluZy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMucGVuZGluZ1NWR3MuY2xlYXIoKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coXCJTVkdBdGxhc0J1aWxkZXIg5Yid5aeL5YyW5a6M5oiQXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5riF55CG5Zu+6ZuG5p6E5bu65ZmoXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgY2xlYW51cEF0bGFzQnVpbGRlcigpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmNsZWFyQWxsQXRsYXNlcygpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiU1ZHQXRsYXNCdWlsZGVyIOa4heeQhuWujOaIkFwiKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOeUn+aIkFNWR+mUrlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGdlbmVyYXRlU1ZHS2V5KHN2Z0NvbnRlbnQ6IHN0cmluZywgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIGNvbG9yPzogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBjb2xvclBhcnQgPSBjb2xvciB8fCBcImRlZmF1bHRcIjtcclxuICAgICAgICBjb25zdCBoYXNoID0gdGhpcy5jYWxjdWxhdGVTaW1wbGVIYXNoKHN2Z0NvbnRlbnQpO1xyXG4gICAgICAgIHJldHVybiBgJHtoYXNofV8ke3dpZHRofXgke2hlaWdodH1fJHtjb2xvclBhcnR9YDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOiuoeeul+eugOWNleWTiOW4jFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGNhbGN1bGF0ZVNpbXBsZUhhc2goc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgICAgIGxldCBoYXNoID0gMDtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCBjaGFyID0gc3RyLmNoYXJDb2RlQXQoaSk7XHJcbiAgICAgICAgICAgIGhhc2ggPSAoaGFzaCA8PCA1KSAtIGhhc2ggKyBjaGFyO1xyXG4gICAgICAgICAgICBoYXNoID0gaGFzaCAmIGhhc2g7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBNYXRoLmFicyhoYXNoKS50b1N0cmluZygxNikuc3Vic3RyaW5nKDAsIDgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5aSE55CG5b6F5aSE55CGU1ZHXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXN5bmMgcHJvY2Vzc1BlbmRpbmdTVkdzKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGlmICh0aGlzLnBlbmRpbmdTVkdzLnNpemUgPT09IDApIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8g5pS26ZuG5b6F5aSE55CGU1ZH55qE6K+m57uG5L+h5oGvXHJcbiAgICAgICAgY29uc3Qgc3ZnRGV0YWlsczogQXJyYXk8e1xyXG4gICAgICAgICAgICBjb250ZW50OiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgICAgICAgICBjb2xvcj86IHN0cmluZztcclxuICAgICAgICB9PiA9IFtdO1xyXG5cclxuICAgICAgICAvLyDov5nph4zpnIDopoHku45wZW5kaW5nU1ZHc+S4reaPkOWPluWunumZhVNWR+WGheWuuVxyXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8muS9v+eUqOWNoOS9jeesplxyXG4gICAgICAgIHRoaXMucGVuZGluZ1NWR3MuZm9yRWFjaCgoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgIC8vIOino+aekOmUruiOt+WPluWwuuWvuOetieS/oeaBr1xyXG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IGtleS5tYXRjaCgvKC4rKV8oXFxkKyl4KFxcZCspXyguKykvKTtcclxuICAgICAgICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBbLCBoYXNoLCB3aWR0aFN0ciwgaGVpZ2h0U3RyLCBjb2xvcl0gPSBtYXRjaDtcclxuICAgICAgICAgICAgICAgIHN2Z0RldGFpbHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogYHN2Z19oYXNoXyR7aGFzaH1gLCAvLyDnroDljJbvvJrlrp7pmYXlupTor6XlrZjlgqhTVkflhoXlrrlcclxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogcGFyc2VJbnQod2lkdGhTdHIpLFxyXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogcGFyc2VJbnQoaGVpZ2h0U3RyKSxcclxuICAgICAgICAgICAgICAgICAgICBjb2xvcjogY29sb3IgIT09IFwiZGVmYXVsdFwiID8gY29sb3IgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoc3ZnRGV0YWlscy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYnVpbGRBdGxhcyhzdmdEZXRhaWxzKTtcclxuICAgICAgICAgICAgdGhpcy5wZW5kaW5nU1ZHcy5jbGVhcigpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOa3u+WKoFNWR+WIsOWbvumbhuW5tuaehOW7ulxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFzeW5jIGFkZFNWR1RvQXRsYXNBbmRCdWlsZChzdmdDb250ZW50OiBzdHJpbmcsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBjb2xvcj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZ2VuZXJhdGVTVkdLZXkoc3ZnQ29udGVudCwgd2lkdGgsIGhlaWdodCwgY29sb3IpO1xyXG5cclxuICAgICAgICAvLyDmo4Dmn6XmmK/lkKbmnInnqbrpl7TotrPlpJ/nmoTnjrDmnInlm77pm4ZcclxuICAgICAgICBjb25zdCBzdWl0YWJsZUF0bGFzID0gdGhpcy5maW5kU3VpdGFibGVBdGxhcyh3aWR0aCwgaGVpZ2h0KTtcclxuICAgICAgICBpZiAoc3VpdGFibGVBdGxhcykge1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFkZFRvRXhpc3RpbmdBdGxhcyhzdWl0YWJsZUF0bGFzLm5hbWUsIHN2Z0NvbnRlbnQsIHdpZHRoLCBoZWlnaHQsIGNvbG9yKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyDliJvlu7rmlrDlm77pm4ZcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5idWlsZEF0bGFzKFtcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBzdmdDb250ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoLFxyXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICBjb2xvcixcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOafpeaJvuWQiOmAgueahOeOsOacieWbvumbhlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGZpbmRTdWl0YWJsZUF0bGFzKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogQXRsYXNEYXRhIHwgbnVsbCB7XHJcbiAgICAgICAgbGV0IGJlc3RBdGxhczogQXRsYXNEYXRhIHwgbnVsbCA9IG51bGw7XHJcbiAgICAgICAgbGV0IGJlc3RTcGFjZVVzYWdlID0gSW5maW5pdHk7XHJcblxyXG4gICAgICAgIHRoaXMuYXRsYXNlcy5mb3JFYWNoKChhdGxhcykgPT4ge1xyXG4gICAgICAgICAgICAvLyDmo4Dmn6Xlm77pm4bmmK/lkKbmnInotrPlpJ/nqbrpl7RcclxuICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgYXRsYXMudXNlZFNwYWNlIDwgMC45ICYmIC8vIOS9v+eUqOeOh+S9juS6jjkwJVxyXG4gICAgICAgICAgICAgICAgd2lkdGggPD0gYXRsYXMud2lkdGggKiAoMSAtIGF0bGFzLnVzZWRTcGFjZSkgJiZcclxuICAgICAgICAgICAgICAgIGhlaWdodCA8PSBhdGxhcy5oZWlnaHQgKiAoMSAtIGF0bGFzLnVzZWRTcGFjZSlcclxuICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgICAgICAvLyDpgInmi6nnqbrpl7Tkvb/nlKjnjofmnIDpq5jnmoTlm77pm4bvvIjmnIDmu6HkvYbku43mnInnqbrpl7TvvIlcclxuICAgICAgICAgICAgICAgIGNvbnN0IHNwYWNlTGVmdCA9IDEgLSBhdGxhcy51c2VkU3BhY2U7XHJcbiAgICAgICAgICAgICAgICBpZiAoc3BhY2VMZWZ0IDwgYmVzdFNwYWNlVXNhZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICBiZXN0U3BhY2VVc2FnZSA9IHNwYWNlTGVmdDtcclxuICAgICAgICAgICAgICAgICAgICBiZXN0QXRsYXMgPSBhdGxhcztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gYmVzdEF0bGFzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5re75Yqg5Yiw546w5pyJ5Zu+6ZuGXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXN5bmMgYWRkVG9FeGlzdGluZ0F0bGFzKFxyXG4gICAgICAgIGF0bGFzTmFtZTogc3RyaW5nLFxyXG4gICAgICAgIHN2Z0NvbnRlbnQ6IHN0cmluZyxcclxuICAgICAgICB3aWR0aDogbnVtYmVyLFxyXG4gICAgICAgIGhlaWdodDogbnVtYmVyLFxyXG4gICAgICAgIGNvbG9yPzogc3RyaW5nXHJcbiAgICApOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgICAgICBjb25zdCBhdGxhcyA9IHRoaXMuYXRsYXNlcy5nZXQoYXRsYXNOYW1lKTtcclxuICAgICAgICBpZiAoIWF0bGFzKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIOi/memHjOW6lOivpeWunueOsOWunumZheeahOWbvumbhuabtOaWsOmAu+i+kVxyXG4gICAgICAgICAgICAvLyDnroDljJblrp7njrDvvJrph43mlrDmnoTlu7rmlbTkuKrlm77pm4ZcclxuICAgICAgICAgICAgY29uc3QgYWxsRW50cmllcyA9IEFycmF5LmZyb20oYXRsYXMuc3ZnRW50cmllcy52YWx1ZXMoKSkubWFwKChlbnRyeSkgPT4gKHtcclxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGVudHJ5LnN2Z0NvbnRlbnQsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogZW50cnkuc2l6ZS54LFxyXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBlbnRyeS5zaXplLnksXHJcbiAgICAgICAgICAgICAgICBjb2xvcjogdGhpcy5leHRyYWN0Q29sb3JGcm9tU1ZHKGVudHJ5LnN2Z0NvbnRlbnQpLFxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICAvLyDmt7vliqDmlrDmnaHnm65cclxuICAgICAgICAgICAgYWxsRW50cmllcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHN2Z0NvbnRlbnQsXHJcbiAgICAgICAgICAgICAgICB3aWR0aCxcclxuICAgICAgICAgICAgICAgIGhlaWdodCxcclxuICAgICAgICAgICAgICAgIGNvbG9yLFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIOmHjeaWsOaehOW7uuWbvumbhlxyXG4gICAgICAgICAgICBjb25zdCBuZXdBdGxhcyA9IGF3YWl0IHRoaXMuY3JlYXRlQXRsYXMoYCR7YXRsYXNOYW1lfV91cGRhdGVkYCwgYWxsRW50cmllcyk7XHJcbiAgICAgICAgICAgIGlmIChuZXdBdGxhcykge1xyXG4gICAgICAgICAgICAgICAgLy8g5pu/5o2i5pen5Zu+6ZuGXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyQXRsYXMoYXRsYXNOYW1lKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXRsYXNlcy5zZXQoYCR7YXRsYXNOYW1lfV91cGRhdGVkYCwgbmV3QXRsYXMpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIOabtOaWsOaYoOWwhFxyXG4gICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5nZW5lcmF0ZVNWR0tleShzdmdDb250ZW50LCB3aWR0aCwgaGVpZ2h0LCBjb2xvcik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN2Z1RvQXRsYXNNYXBwaW5nLnNldChrZXksIHtcclxuICAgICAgICAgICAgICAgICAgICBhdGxhc05hbWU6IGAke2F0bGFzTmFtZX1fdXBkYXRlZGAsXHJcbiAgICAgICAgICAgICAgICAgICAgZW50cnlLZXk6IGtleSxcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIua3u+WKoOWIsOeOsOacieWbvumbhuWksei0pTpcIiwgZXJyb3IpO1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5LuOU1ZH5o+Q5Y+W6aKc6ImyXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgZXh0cmFjdENvbG9yRnJvbVNWRyhzdmdDb250ZW50OiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xyXG4gICAgICAgIGNvbnN0IGNvbG9yTWF0Y2ggPSBzdmdDb250ZW50Lm1hdGNoKC9maWxsPVwiKFteXCJdKilcIi8pO1xyXG4gICAgICAgIGlmIChjb2xvck1hdGNoICYmIGNvbG9yTWF0Y2hbMV0gIT09IFwibm9uZVwiICYmIGNvbG9yTWF0Y2hbMV0gIT09IFwidHJhbnNwYXJlbnRcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gY29sb3JNYXRjaFsxXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIm+W7uuWbvumbhlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZUF0bGFzKFxyXG4gICAgICAgIG5hbWU6IHN0cmluZyxcclxuICAgICAgICBzdmdDb250ZW50czogQXJyYXk8e1xyXG4gICAgICAgICAgICBjb250ZW50OiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgICAgICAgICBjb2xvcj86IHN0cmluZztcclxuICAgICAgICB9PlxyXG4gICAgKTogUHJvbWlzZTxBdGxhc0RhdGEgfCBudWxsPiB7XHJcbiAgICAgICAgaWYgKHN2Z0NvbnRlbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIOiuoeeul+WbvumbhuWwuuWvuFxyXG4gICAgICAgICAgICBjb25zdCBhdGxhc1NpemUgPSB0aGlzLmNhbGN1bGF0ZUF0bGFzU2l6ZShzdmdDb250ZW50cyk7XHJcbiAgICAgICAgICAgIGlmIChhdGxhc1NpemUud2lkdGggPT09IDAgfHwgYXRsYXNTaXplLmhlaWdodCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIOWIm+W7ukNhbnZhc1xyXG4gICAgICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO1xyXG4gICAgICAgICAgICBjYW52YXMud2lkdGggPSBhdGxhc1NpemUud2lkdGg7XHJcbiAgICAgICAgICAgIGNhbnZhcy5oZWlnaHQgPSBhdGxhc1NpemUuaGVpZ2h0O1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcclxuICAgICAgICAgICAgaWYgKCFjdHgpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIuaXoOazleiOt+WPlkNhbnZhcyAyROS4iuS4i+aWh1wiKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g5riF56m655S75biDXHJcbiAgICAgICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcclxuXHJcbiAgICAgICAgICAgIC8vIOefqeW9ouWMheijheeul+azle+8iOeugOWMlu+8mueugOWNlee9keagvOW4g+WxgO+8iVxyXG4gICAgICAgICAgICBjb25zdCBlbnRyaWVzID0gbmV3IE1hcDxzdHJpbmcsIEF0bGFzRW50cnk+KCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNlbGxTaXplID0gdGhpcy5jYWxjdWxhdGVDZWxsU2l6ZShzdmdDb250ZW50cyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbHMgPSBNYXRoLmZsb29yKGF0bGFzU2l6ZS53aWR0aCAvIGNlbGxTaXplKTtcclxuICAgICAgICAgICAgY29uc3Qgcm93cyA9IE1hdGguY2VpbChzdmdDb250ZW50cy5sZW5ndGggLyBjb2xzKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBpbmRleCA9IDA7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc3ZnIG9mIHN2Z0NvbnRlbnRzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggPj0gY29scyAqIHJvd3MpIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbCA9IGluZGV4ICUgY29scztcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IE1hdGguZmxvb3IoaW5kZXggLyBjb2xzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gY29sICogY2VsbFNpemUgKyB0aGlzLnBhZGRpbmc7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gcm93ICogY2VsbFNpemUgKyB0aGlzLnBhZGRpbmc7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRyeVdpZHRoID0gY2VsbFNpemUgLSB0aGlzLnBhZGRpbmcgKiAyO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZW50cnlIZWlnaHQgPSBjZWxsU2l6ZSAtIHRoaXMucGFkZGluZyAqIDI7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g6I635Y+WU1ZH57K+54G15binXHJcbiAgICAgICAgICAgICAgICBjb25zdCBzcHJpdGVGcmFtZSA9IGF3YWl0IFNWR1Nwcml0ZUNhY2hlLmdldFNWR1Nwcml0ZUZyYW1lKHN2Zy5jb250ZW50LCBlbnRyeVdpZHRoLCBlbnRyeUhlaWdodCwgc3ZnLmNvbG9yKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDov5nph4zlupTor6XlsIZTVkfnu5jliLbliLBDYW52YXPnmoTlr7nlupTkvY3nva5cclxuICAgICAgICAgICAgICAgIC8vIOeugOWMluWunueOsO+8mue7mOWItuS4gOS4quWNoOS9jeefqeW9olxyXG4gICAgICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwicmdiYSgxMDAsIDEwMCwgMTAwLCAwLjUpXCI7XHJcbiAgICAgICAgICAgICAgICBjdHguZmlsbFJlY3QoeCwgeSwgZW50cnlXaWR0aCwgZW50cnlIZWlnaHQpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIOWIm+W7uuWbvumbhuadoeebrlxyXG4gICAgICAgICAgICAgICAgY29uc3QgZW50cnlLZXkgPSB0aGlzLmdlbmVyYXRlU1ZHS2V5KHN2Zy5jb250ZW50LCBzdmcud2lkdGgsIHN2Zy5oZWlnaHQsIHN2Zy5jb2xvcik7XHJcbiAgICAgICAgICAgICAgICBlbnRyaWVzLnNldChlbnRyeUtleSwge1xyXG4gICAgICAgICAgICAgICAgICAgIHN2Z0NvbnRlbnQ6IHN2Zy5jb250ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgIHV2UmVjdDogbmV3IFJlY3QoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHggLyBhdGxhc1NpemUud2lkdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHkgLyBhdGxhc1NpemUuaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnRyeVdpZHRoIC8gYXRsYXNTaXplLndpZHRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnRyeUhlaWdodCAvIGF0bGFzU2l6ZS5oZWlnaHRcclxuICAgICAgICAgICAgICAgICAgICApLFxyXG4gICAgICAgICAgICAgICAgICAgIHBpeGVsUmVjdDogbmV3IFJlY3QoeCwgeSwgZW50cnlXaWR0aCwgZW50cnlIZWlnaHQpLFxyXG4gICAgICAgICAgICAgICAgICAgIHNpemU6IG5ldyBWZWMyKHN2Zy53aWR0aCwgc3ZnLmhlaWdodCksXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBpbmRleCsrO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDliJvlu7rnurnnkIZcclxuICAgICAgICAgICAgY29uc3QgaW1hZ2VBc3NldCA9IG5ldyBJbWFnZUFzc2V0KGNhbnZhcyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZTJEKCk7XHJcbiAgICAgICAgICAgIHRleHR1cmUuaW1hZ2UgPSBpbWFnZUFzc2V0O1xyXG5cclxuICAgICAgICAgICAgLy8g5Yib5bu657K+54G15binXHJcbiAgICAgICAgICAgIGNvbnN0IHNwcml0ZUZyYW1lID0gbmV3IFNwcml0ZUZyYW1lKCk7XHJcbiAgICAgICAgICAgIHNwcml0ZUZyYW1lLnRleHR1cmUgPSB0ZXh0dXJlO1xyXG5cclxuICAgICAgICAgICAgLy8g6K6h566X56m66Ze05L2/55So546HXHJcbiAgICAgICAgICAgIGNvbnN0IHRvdGFsQ2VsbHMgPSBjb2xzICogcm93cztcclxuICAgICAgICAgICAgY29uc3QgdXNlZENlbGxzID0gTWF0aC5taW4oc3ZnQ29udGVudHMubGVuZ3RoLCB0b3RhbENlbGxzKTtcclxuICAgICAgICAgICAgY29uc3QgdXNlZFNwYWNlID0gKHVzZWRDZWxscyAqIGNlbGxTaXplICogY2VsbFNpemUpIC8gKGF0bGFzU2l6ZS53aWR0aCAqIGF0bGFzU2l6ZS5oZWlnaHQpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLFxyXG4gICAgICAgICAgICAgICAgc3ByaXRlRnJhbWUsXHJcbiAgICAgICAgICAgICAgICBzdmdFbnRyaWVzOiBlbnRyaWVzLFxyXG4gICAgICAgICAgICAgICAgdXNlZFNwYWNlLFxyXG4gICAgICAgICAgICAgICAgd2lkdGg6IGF0bGFzU2l6ZS53aWR0aCxcclxuICAgICAgICAgICAgICAgIGhlaWdodDogYXRsYXNTaXplLmhlaWdodCxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwi5Yib5bu65Zu+6ZuG5aSx6LSlOlwiLCBlcnJvcik7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOiuoeeul+WbvumbhuWwuuWvuFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGNhbGN1bGF0ZUF0bGFzU2l6ZShcclxuICAgICAgICBzdmdDb250ZW50czogQXJyYXk8e1xyXG4gICAgICAgICAgICBjb250ZW50OiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgICAgICAgICBjb2xvcj86IHN0cmluZztcclxuICAgICAgICB9PlxyXG4gICAgKTogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHtcclxuICAgICAgICBpZiAoc3ZnQ29udGVudHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHdpZHRoOiAwLCBoZWlnaHQ6IDAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOeugOWNleiuoeeul++8muWfuuS6jlNWR+aVsOmHj+WSjOacgOWkp+WwuuWvuFxyXG4gICAgICAgIGNvbnN0IG1heFdpZHRoID0gTWF0aC5tYXgoLi4uc3ZnQ29udGVudHMubWFwKChzdmcpID0+IHN2Zy53aWR0aCkpO1xyXG4gICAgICAgIGNvbnN0IG1heEhlaWdodCA9IE1hdGgubWF4KC4uLnN2Z0NvbnRlbnRzLm1hcCgoc3ZnKSA9PiBzdmcuaGVpZ2h0KSk7XHJcblxyXG4gICAgICAgIC8vIOiuoeeul+e9keagvOW4g+WxgFxyXG4gICAgICAgIGNvbnN0IGNlbGxTaXplID0gTWF0aC5tYXgobWF4V2lkdGgsIG1heEhlaWdodCkgKyB0aGlzLnBhZGRpbmcgKiAyO1xyXG4gICAgICAgIGNvbnN0IHN2Z0NvdW50ID0gc3ZnQ29udGVudHMubGVuZ3RoO1xyXG5cclxuICAgICAgICAvLyDkvLDnrpfmiYDpnIDooYzliJdcclxuICAgICAgICBjb25zdCBlc3RpbWF0ZWRDZWxscyA9IHN2Z0NvdW50O1xyXG4gICAgICAgIGNvbnN0IHNpZGUgPSBNYXRoLmNlaWwoTWF0aC5zcXJ0KGVzdGltYXRlZENlbGxzKSk7XHJcblxyXG4gICAgICAgIGxldCB3aWR0aCA9IE1hdGgubWluKHNpZGUgKiBjZWxsU2l6ZSwgdGhpcy5tYXhBdGxhc1dpZHRoKTtcclxuICAgICAgICBsZXQgaGVpZ2h0ID0gTWF0aC5taW4oc2lkZSAqIGNlbGxTaXplLCB0aGlzLm1heEF0bGFzSGVpZ2h0KTtcclxuXHJcbiAgICAgICAgLy8g56Gu5L+d5bC65a+45pivMueahOW5gu+8iOe6ueeQhuS8mOWMlu+8iVxyXG4gICAgICAgIHdpZHRoID0gdGhpcy5uZXh0UG93ZXJPZlR3byh3aWR0aCk7XHJcbiAgICAgICAgaGVpZ2h0ID0gdGhpcy5uZXh0UG93ZXJPZlR3byhoZWlnaHQpO1xyXG5cclxuICAgICAgICByZXR1cm4geyB3aWR0aCwgaGVpZ2h0IH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDorqHnrpfljZXlhYPmoLzlsLrlr7hcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBjYWxjdWxhdGVDZWxsU2l6ZShcclxuICAgICAgICBzdmdDb250ZW50czogQXJyYXk8e1xyXG4gICAgICAgICAgICBjb250ZW50OiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgICAgICAgICBjb2xvcj86IHN0cmluZztcclxuICAgICAgICB9PlxyXG4gICAgKTogbnVtYmVyIHtcclxuICAgICAgICBpZiAoc3ZnQ29udGVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gMDtcclxuXHJcbiAgICAgICAgLy8g5om+5Yiw5pyA5aSn5bC65a+45bm25Yqg5LiKcGFkZGluZ1xyXG4gICAgICAgIGNvbnN0IG1heFdpZHRoID0gTWF0aC5tYXgoLi4uc3ZnQ29udGVudHMubWFwKChzdmcpID0+IHN2Zy53aWR0aCkpO1xyXG4gICAgICAgIGNvbnN0IG1heEhlaWdodCA9IE1hdGgubWF4KC4uLnN2Z0NvbnRlbnRzLm1hcCgoc3ZnKSA9PiBzdmcuaGVpZ2h0KSk7XHJcbiAgICAgICAgY29uc3QgbWF4U2l6ZSA9IE1hdGgubWF4KG1heFdpZHRoLCBtYXhIZWlnaHQpO1xyXG5cclxuICAgICAgICByZXR1cm4gbWF4U2l6ZSArIHRoaXMucGFkZGluZyAqIDI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDkuIvkuIDkuKoy55qE5bmCXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgbmV4dFBvd2VyT2ZUd28objogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgICAgICBuLS07XHJcbiAgICAgICAgbiB8PSBuID4+IDE7XHJcbiAgICAgICAgbiB8PSBuID4+IDI7XHJcbiAgICAgICAgbiB8PSBuID4+IDQ7XHJcbiAgICAgICAgbiB8PSBuID4+IDg7XHJcbiAgICAgICAgbiB8PSBuID4+IDE2O1xyXG4gICAgICAgIG4rKztcclxuICAgICAgICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgobiwgNjQpLCB0aGlzLm1heEF0bGFzV2lkdGgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5ZCI5bm25oiW5pu/5o2i5Zu+6ZuGXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXN5bmMgbWVyZ2VPclJlcGxhY2VBdGxhcyhcclxuICAgICAgICBzdmdDb250ZW50czogQXJyYXk8e1xyXG4gICAgICAgICAgICBjb250ZW50OiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgICAgICAgICBjb2xvcj86IHN0cmluZztcclxuICAgICAgICB9PlxyXG4gICAgKTogUHJvbWlzZTxBdGxhc0RhdGEgfCBudWxsPiB7XHJcbiAgICAgICAgLy8g5om+5Yiw5L2/55So546H5pyA5L2O55qE5Zu+6ZuGXHJcbiAgICAgICAgbGV0IGxvd2VzdFVzYWdlQXRsYXM6IHsgbmFtZTogc3RyaW5nOyB1c2FnZTogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcclxuXHJcbiAgICAgICAgdGhpcy5hdGxhc2VzLmZvckVhY2goKGF0bGFzLCBuYW1lKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghbG93ZXN0VXNhZ2VBdGxhcyB8fCBhdGxhcy51c2VkU3BhY2UgPCBsb3dlc3RVc2FnZUF0bGFzLnVzYWdlKSB7XHJcbiAgICAgICAgICAgICAgICBsb3dlc3RVc2FnZUF0bGFzID0geyBuYW1lOiBuYW1lLCB1c2FnZTogYXRsYXMudXNlZFNwYWNlIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKGxvd2VzdFVzYWdlQXRsYXMpIHtcclxuICAgICAgICAgICAgLy8g5riF6Zmk5L2/55So546H5pyA5L2O55qE5Zu+6ZuGXHJcbiAgICAgICAgICAgIHRoaXMuY2xlYXJBdGxhcygobG93ZXN0VXNhZ2VBdGxhcyBhcyB7IG5hbWU6IHN0cmluZzsgdXNhZ2U6IG51bWJlciB9KS5uYW1lKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOWIm+W7uuaWsOWbvumbhlxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5idWlsZEF0bGFzKHN2Z0NvbnRlbnRzKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5LyY5YyW5oyH5a6a5Zu+6ZuGXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXN5bmMgb3B0aW1pemVBdGxhcyhhdGxhc05hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGNvbnN0IGF0bGFzID0gdGhpcy5hdGxhc2VzLmdldChhdGxhc05hbWUpO1xyXG4gICAgICAgIGlmICghYXRsYXMpIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8g5pS26ZuG5omA5pyJ5p2h55uuXHJcbiAgICAgICAgY29uc3QgYWxsRW50cmllcyA9IEFycmF5LmZyb20oYXRsYXMuc3ZnRW50cmllcy52YWx1ZXMoKSkubWFwKChlbnRyeSkgPT4gKHtcclxuICAgICAgICAgICAgY29udGVudDogZW50cnkuc3ZnQ29udGVudCxcclxuICAgICAgICAgICAgd2lkdGg6IGVudHJ5LnNpemUueCxcclxuICAgICAgICAgICAgaGVpZ2h0OiBlbnRyeS5zaXplLnksXHJcbiAgICAgICAgICAgIGNvbG9yOiB0aGlzLmV4dHJhY3RDb2xvckZyb21TVkcoZW50cnkuc3ZnQ29udGVudCksXHJcbiAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAvLyDph43mlrDmnoTlu7rlm77pm4bvvIjlj6/og73mm7TntKflh5HvvIlcclxuICAgICAgICBjb25zdCBvcHRpbWl6ZWRBdGxhcyA9IGF3YWl0IHRoaXMuY3JlYXRlQXRsYXMoYCR7YXRsYXNOYW1lfV9vcHRpbWl6ZWRgLCBhbGxFbnRyaWVzKTtcclxuICAgICAgICBpZiAob3B0aW1pemVkQXRsYXMgJiYgb3B0aW1pemVkQXRsYXMudXNlZFNwYWNlID4gYXRsYXMudXNlZFNwYWNlKSB7XHJcbiAgICAgICAgICAgIC8vIOabv+aNouaXp+WbvumbhlxyXG4gICAgICAgICAgICB0aGlzLmNsZWFyQXRsYXMoYXRsYXNOYW1lKTtcclxuICAgICAgICAgICAgdGhpcy5hdGxhc2VzLnNldChgJHthdGxhc05hbWV9X29wdGltaXplZGAsIG9wdGltaXplZEF0bGFzKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOabtOaWsOaYoOWwhFxyXG4gICAgICAgICAgICBvcHRpbWl6ZWRBdGxhcy5zdmdFbnRyaWVzLmZvckVhY2goKGVudHJ5LCBrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3ZnVG9BdGxhc01hcHBpbmcuc2V0KGtleSwge1xyXG4gICAgICAgICAgICAgICAgICAgIGF0bGFzTmFtZTogYCR7YXRsYXNOYW1lfV9vcHRpbWl6ZWRgLFxyXG4gICAgICAgICAgICAgICAgICAgIGVudHJ5S2V5OiBrZXksXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhg5Zu+6ZuG5LyY5YyW5a6M5oiQOiAke2F0bGFzTmFtZX0gLT4gJHthdGxhc05hbWV9X29wdGltaXplZGApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iXX0=