import { _decorator, Component, Sprite, SpriteFrame, Texture2D, ImageAsset, Vec3, director, Camera, UITransform } from "cc";
const { ccclass, property, executeInEditMode, menu } = _decorator;

import { SVGSpriteCache } from "./SVGSpriteCache";

/**
 * SVG批量渲染器
 * 优化大量SVG渲染性能，减少Draw Call
 */
@ccclass("SVGBatchRenderer")
@menu("2D/SVGBatchRenderer")
@executeInEditMode
export class SVGBatchRenderer extends Component {
    // ========== 批量配置 ==========

    @property({
        tooltip: "启用自动合批",
        displayName: "自动合批",
    })
    private enableAutoBatching: boolean = true;

    @property({
        tooltip: "合批距离阈值（像素）",
        displayName: "合批距离",
        min: 0,
    })
    private batchDistanceThreshold: number = 50;

    @property({
        tooltip: "最大每批数量",
        displayName: "每批最大数",
        min: 1,
        max: 100,
    })
    private maxBatchSize: number = 20;

    @property({
        tooltip: "启用分帧渲染",
        displayName: "分帧渲染",
    })
    private enableFrameSplitting: boolean = false;

    @property({
        tooltip: "每帧渲染数量",
        displayName: "每帧数量",
        min: 1,
        visible: function (this: SVGBatchRenderer) {
            return this.enableFrameSplitting;
        },
    })
    private spritesPerFrame: number = 5;

    // ========== 性能监控 ==========

    @property({
        tooltip: "启用性能监控",
        displayName: "性能监控",
    })
    private enablePerformanceMonitoring: boolean = false;

    @property({
        tooltip: "监控更新间隔（秒）",
        displayName: "监控间隔",
        min: 0.1,
        max: 5,
        visible: function (this: SVGBatchRenderer) {
            return this.enablePerformanceMonitoring;
        },
    })
    private monitorInterval: number = 1.0;

    // ========== 内部状态 ==========

    private batchedSprites: Map<string, Sprite[]> = new Map(); // SVG内容 -> Sprite数组
    private pendingSprites: Sprite[] = []; // 待处理精灵
    private batchTextures: Map<string, Texture2D> = new Map(); // 批量纹理缓存
    private frameCounter: number = 0;
    private lastMonitorTime: number = 0;

    private performanceStats = {
        totalSprites: 0,
        batchCount: 0,
        drawCallReduction: 0,
        averageBatchSize: 0,
        lastFrameTime: 0,
    };

    // ========== 生命周期方法 ==========

    onLoad() {
        this.initializeBatchRenderer();
    }

    onDestroy() {
        this.cleanupBatchRenderer();
    }

    update(deltaTime: number) {
        if (this.enableAutoBatching) {
            this.processAutoBatching();
        }

        if (this.enableFrameSplitting) {
            this.processFrameSplitting(deltaTime);
        }

        if (this.enablePerformanceMonitoring) {
            this.updatePerformanceMonitoring(deltaTime);
        }
    }

    // ========== 公共方法 ==========

    /**
     * 手动添加精灵到批量渲染
     * @param sprite 精灵组件
     * @param svgContent SVG内容（可选，自动从精灵获取）
     */
    public addSpriteToBatch(sprite: Sprite, svgContent?: string): void {
        if (!sprite || !sprite.spriteFrame) {
            console.warn("精灵或精灵帧无效");
            return;
        }

        const content = svgContent || this.extractSVGContentFromSprite(sprite);
        if (!content) {
            console.warn("无法获取SVG内容");
            return;
        }

        if (this.enableAutoBatching) {
            this.pendingSprites.push(sprite);
        } else {
            this.addToBatch(content, sprite);
        }
    }

    /**
     * 批量渲染相同SVG的多个实例
     * @param svgContent SVG内容
     * @param sprites 精灵数组
     */
    public async batchRenderSameSVG(svgContent: string, sprites: Sprite[]): Promise<void> {
        if (!svgContent || sprites.length === 0) return;

        try {
            // 创建批量纹理
            const batchTexture = await this.createBatchTexture(svgContent, sprites);
            if (!batchTexture) return;

            // 应用批量纹理到所有精灵
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = batchTexture;

            sprites.forEach((sprite) => {
                if (sprite && sprite.isValid) {
                    sprite.spriteFrame = spriteFrame;
                    this.addToBatch(svgContent, sprite);
                }
            });

            this.performanceStats.batchCount++;
            this.performanceStats.drawCallReduction += sprites.length - 1;
        } catch (error) {
            console.error("批量渲染失败:", error);
        }
    }

    /**
     * 执行自动合批
     */
    public async performAutoBatching(): Promise<void> {
        if (this.pendingSprites.length === 0) return;

        // 按SVG内容分组
        const spriteGroups = new Map<string, Sprite[]>();

        for (const sprite of this.pendingSprites) {
            if (!sprite.isValid) continue;

            const content = this.extractSVGContentFromSprite(sprite);
            if (content) {
                if (!spriteGroups.has(content)) {
                    spriteGroups.set(content, []);
                }
                spriteGroups.get(content)!.push(sprite);
            }
        }

        // 批量处理每组
        for (const [content, sprites] of spriteGroups) {
            if (sprites.length > 1) {
                await this.batchRenderSameSVG(content, sprites);
            }
        }

        this.pendingSprites = [];
    }

    /**
     * 清除所有批量数据
     */
    public clearAllBatches(): void {
        this.batchedSprites.clear();
        this.batchTextures.clear();
        this.pendingSprites = [];

        // 释放纹理资源
        this.batchTextures.forEach((texture) => {
            if (texture) {
                texture.destroy();
            }
        });

        this.batchTextures.clear();
        this.performanceStats.batchCount = 0;
        this.performanceStats.drawCallReduction = 0;
    }

    /**
     * 获取性能统计
     */
    public getPerformanceStats(): typeof this.performanceStats {
        const totalBatchedSprites = Array.from(this.batchedSprites.values()).reduce((sum, sprites) => sum + sprites.length, 0);

        this.performanceStats.totalSprites = totalBatchedSprites + this.pendingSprites.length;
        this.performanceStats.averageBatchSize =
            this.performanceStats.batchCount > 0 ? totalBatchedSprites / this.performanceStats.batchCount : 0;

        return { ...this.performanceStats };
    }

    /**
     * 优化特定区域内的精灵
     * @param center 中心位置
     * @param radius 半径
     */
    public async optimizeArea(center: Vec3, radius: number): Promise<void> {
        const camera = director.getScene()?.getComponentInChildren(Camera);
        if (!camera) return;

        const spritesInArea: Sprite[] = [];

        // 查找区域内的精灵（简化实现）
        // 实际项目中需要更精确的空间查询
        this.batchedSprites.forEach((sprites, content) => {
            sprites.forEach((sprite) => {
                if (sprite.node && sprite.node.isValid) {
                    const spritePos = sprite.node.worldPosition;
                    const distance = spritePos.subtract(center).length();

                    if (distance <= radius) {
                        spritesInArea.push(sprite);
                    }
                }
            });
        });

        if (spritesInArea.length > 1) {
            // 尝试合批区域内的精灵
            await this.optimizeSpriteGroup(spritesInArea);
        }
    }

    // ========== 私有方法 ==========

    /**
     * 初始化批量渲染器
     */
    private initializeBatchRenderer(): void {
        this.batchedSprites.clear();
        this.batchTextures.clear();
        this.pendingSprites = [];
        this.frameCounter = 0;
        this.lastMonitorTime = 0;

        console.log("SVGBatchRenderer 初始化完成");
    }

    /**
     * 清理批量渲染器
     */
    private cleanupBatchRenderer(): void {
        this.clearAllBatches();
        console.log("SVGBatchRenderer 清理完成");
    }

    /**
     * 处理自动合批
     */
    private processAutoBatching(): void {
        if (this.pendingSprites.length >= this.maxBatchSize) {
            this.performAutoBatching().catch(console.error);
        }
    }

    /**
     * 处理分帧渲染
     */
    private processFrameSplitting(deltaTime: number): void {
        this.frameCounter++;

        // 每N帧处理一批
        if (this.frameCounter % Math.max(1, Math.floor(60 / this.spritesPerFrame)) === 0) {
            if (this.pendingSprites.length > 0) {
                const batch = this.pendingSprites.splice(0, this.spritesPerFrame);
                this.processSpriteBatch(batch).catch(console.error);
            }
        }
    }

    /**
     * 更新性能监控
     */
    private updatePerformanceMonitoring(deltaTime: number): void {
        this.lastMonitorTime += deltaTime;

        if (this.lastMonitorTime >= this.monitorInterval) {
            const stats = this.getPerformanceStats();
            console.log(`SVG批量渲染统计:
                总精灵数: ${stats.totalSprites}
                批次数: ${stats.batchCount}
                Draw Call减少: ${stats.drawCallReduction}
                平均批大小: ${stats.averageBatchSize.toFixed(2)}
            `);

            this.lastMonitorTime = 0;
        }
    }

    /**
     * 从精灵提取SVG内容
     */
    private extractSVGContentFromSprite(sprite: Sprite): string | null {
        // 这里需要根据实际项目结构获取SVG内容
        // 简化实现：返回一个标识符
        if (sprite.node) {
            const spriteComp = sprite.node.getComponent("SVGSprite");
            if (spriteComp && (spriteComp as any).svgContent) {
                return (spriteComp as any).svgContent;
            }
        }
        return null;
    }

    /**
     * 添加到批次
     */
    private addToBatch(svgContent: string, sprite: Sprite): void {
        if (!this.batchedSprites.has(svgContent)) {
            this.batchedSprites.set(svgContent, []);
        }

        const batch = this.batchedSprites.get(svgContent)!;
        // 使用indexOf替代includes以兼容更低ES版本
        if (batch.indexOf(sprite) === -1) {
            batch.push(sprite);
        }
    }

    /**
     * 创建批量纹理
     */
    private async createBatchTexture(svgContent: string, sprites: Sprite[]): Promise<Texture2D | null> {
        const cacheKey = `batch_${svgContent}_${sprites.length}`;

        // 检查缓存
        if (this.batchTextures.has(cacheKey)) {
            return this.batchTextures.get(cacheKey)!;
        }

        try {
            // 计算批量纹理尺寸
            const batchSize = this.calculateBatchTextureSize(sprites);
            if (batchSize.width === 0 || batchSize.height === 0) {
                return null;
            }

            // 创建Canvas
            const canvas = document.createElement("canvas");
            canvas.width = batchSize.width;
            canvas.height = batchSize.height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                throw new Error("无法获取Canvas 2D上下文");
            }

            // 清空画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 获取单个SVG纹理
            const singleTexture = await SVGSpriteCache.getSimpleSVGSpriteFrame(
                svgContent,
                Math.max(...sprites.map((s) => this.getSpriteSize(s).width))
            );

            if (!singleTexture.texture) {
                throw new Error("无法获取SVG纹理");
            }

            // 绘制所有实例（简化：平铺）
            const cols = Math.ceil(Math.sqrt(sprites.length));
            const rows = Math.ceil(sprites.length / cols);
            const cellWidth = batchSize.width / cols;
            const cellHeight = batchSize.height / rows;

            // 这里应该使用实际的SVG渲染逻辑
            // 简化实现：使用占位符
            ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 创建纹理
            const imageAsset = new ImageAsset(canvas);
            const texture = new Texture2D();
            texture.image = imageAsset;

            // 缓存纹理
            this.batchTextures.set(cacheKey, texture);

            return texture;
        } catch (error) {
            console.error("创建批量纹理失败:", error);
            return null;
        }
    }

    /**
     * 计算批量纹理尺寸
     */
    private calculateBatchTextureSize(sprites: Sprite[]): { width: number; height: number } {
        if (sprites.length === 0) {
            return { width: 0, height: 0 };
        }

        // 简单计算：基于精灵数量和平均尺寸
        const totalArea = sprites.reduce((sum, sprite) => {
            const size = this.getSpriteSize(sprite);
            return sum + size.width * size.height;
        }, 0);

        const avgArea = totalArea / sprites.length;
        const spriteCount = sprites.length;

        // 估算纹理尺寸（保持宽高比）
        const estimatedPixels = avgArea * spriteCount * 1.5; // 包含padding
        const side = Math.ceil(Math.sqrt(estimatedPixels));

        return { width: side, height: side };
    }

    /**
     * 获取精灵尺寸
     */
    private getSpriteSize(sprite: Sprite): { width: number; height: number } {
        if (sprite.node) {
            const uiTransform = sprite.node.getComponent(UITransform);
            if (uiTransform) {
                return { width: uiTransform.width, height: uiTransform.height };
            }
        }

        if (sprite.spriteFrame) {
            // 对于SVG精灵，使用精灵帧的原始尺寸
            // 或者使用UITransform的尺寸
            return { width: 100, height: 100 }; // 简化：返回默认尺寸
        }

        return { width: 100, height: 100 }; // 默认尺寸
    }

    /**
     * 处理精灵批次
     */
    private async processSpriteBatch(sprites: Sprite[]): Promise<void> {
        // 按SVG内容分组
        const groups = new Map<string, Sprite[]>();

        for (const sprite of sprites) {
            const content = this.extractSVGContentFromSprite(sprite);
            if (content) {
                if (!groups.has(content)) {
                    groups.set(content, []);
                }
                groups.get(content)!.push(sprite);
            }
        }

        // 处理每个组
        for (const [content, groupSprites] of groups) {
            if (groupSprites.length > 1) {
                await this.batchRenderSameSVG(content, groupSprites);
            }
        }
    }

    /**
     * 优化精灵组
     */
    private async optimizeSpriteGroup(sprites: Sprite[]): Promise<void> {
        // 按SVG内容分组
        const groups = new Map<string, Sprite[]>();

        for (const sprite of sprites) {
            const content = this.extractSVGContentFromSprite(sprite);
            if (content) {
                if (!groups.has(content)) {
                    groups.set(content, []);
                }
                groups.get(content)!.push(sprite);
            }
        }

        // 合批每个组
        const promises: Promise<void>[] = [];

        for (const [content, groupSprites] of groups) {
            if (groupSprites.length > 1) {
                promises.push(this.batchRenderSameSVG(content, groupSprites));
            }
        }

        await Promise.all(promises);
    }

    /**
     * 检查精灵是否在视口内
     */
    private isSpriteInViewport(sprite: Sprite, camera: Camera): boolean {
        if (!sprite.node || !camera) return false;

        // 简化实现：检查节点是否激活
        return sprite.node.active;
    }
}
