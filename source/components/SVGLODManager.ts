import { _decorator, Component, Node, Sprite, Camera, Vec3, director, UITransform } from "cc";
const { ccclass, property, executeInEditMode, menu, icon } = _decorator;

import { SVGSpriteCache } from "./SVGSpriteCache";

/**
 * LOD级别配置
 */
interface LODLevel {
    name: string;
    distanceThreshold: number; // 距离阈值
    screenSizeThreshold: number; // 屏幕尺寸阈值（像素）
    quality: number; // 质量级别（0-1）
    simplifyFactor: number; // 简化因子（0-1，1表示不简化）
    updateInterval: number; // 更新间隔（秒）
}

/**
 * 管理精灵接口
 */
interface ManagedSprite {
    sprite: Sprite;
    node: Node;
    originalSVGContent: string;
    originalWidth: number;
    originalHeight: number;
    originalColor?: string;
    currentLODLevel: number;
    lastUpdateTime: number;
    distanceToCamera: number;
    screenSize: number;
    isVisible: boolean;
}

/**
 * SVG细节层次管理器
 * 根据距离和屏幕尺寸动态调整SVG的细节级别，优化性能
 */
@ccclass("SVGLODManager")
@icon("../../Inkpen_stroke.png")
@menu("2D/SVGLODManager")
@executeInEditMode
export class SVGLODManager extends Component {
    // ========== LOD配置 ==========

    @property({
        tooltip: "启用LOD系统",
        displayName: "启用LOD",
    })
    private enableLOD: boolean = true;

    @property({
        tooltip: "LOD级别配置",
        displayName: "LOD级别",
    })
    private lodLevels: LODLevel[] = [
        {
            name: "高细节",
            distanceThreshold: 10,
            screenSizeThreshold: 100,
            quality: 1.0,
            simplifyFactor: 1.0,
            updateInterval: 0.5,
        },
        {
            name: "中细节",
            distanceThreshold: 30,
            screenSizeThreshold: 50,
            quality: 0.7,
            simplifyFactor: 0.7,
            updateInterval: 1.0,
        },
        {
            name: "低细节",
            distanceThreshold: 50,
            screenSizeThreshold: 20,
            quality: 0.4,
            simplifyFactor: 0.4,
            updateInterval: 2.0,
        },
        {
            name: "极低细节",
            distanceThreshold: 100,
            screenSizeThreshold: 10,
            quality: 0.2,
            simplifyFactor: 0.2,
            updateInterval: 3.0,
        },
    ];

    @property({
        tooltip: "启用动态LOD更新",
        displayName: "动态更新",
    })
    private enableDynamicUpdates: boolean = true;

    @property({
        tooltip: "LOD更新间隔（秒）",
        displayName: "更新间隔",
        min: 0.1,
        max: 5.0,
    })
    private lodUpdateInterval: number = 1.0;

    // ========== 性能配置 ==========

    @property({
        tooltip: "最大同时更新数量",
        displayName: "最大更新数",
        min: 1,
        max: 20,
    })
    private maxConcurrentUpdates: number = 5;

    @property({
        tooltip: "启用性能监控",
        displayName: "性能监控",
    })
    private enablePerformanceMonitoring: boolean = false;

    // ========== 内部状态 ==========

    private managedSprites: Map<string, ManagedSprite> = new Map(); // 管理的精灵
    private camera: Camera | null = null;
    private updateTimer: number = 0;
    private pendingUpdates: Set<string> = new Set(); // 待更新精灵
    private updateQueue: string[] = []; // 更新队列

    private performanceStats = {
        totalSprites: 0,
        highDetailCount: 0,
        mediumDetailCount: 0,
        lowDetailCount: 0,
        veryLowDetailCount: 0,
        lastUpdateTime: 0,
        averageUpdateTime: 0,
    };

    // ========== 生命周期方法 ==========

    onLoad() {
        this.initializeLODManager();
    }

    onDestroy() {
        this.cleanupLODManager();
    }

    update(deltaTime: number) {
        if (!this.enableLOD) return;

        this.updateTimer += deltaTime;

        // 定期更新LOD
        if (this.updateTimer >= this.lodUpdateInterval) {
            this.updateLODForAllSprites();
            this.updateTimer = 0;
        }

        // 处理动态更新
        if (this.enableDynamicUpdates && this.pendingUpdates.size > 0) {
            this.processPendingUpdates();
        }

        // 更新性能监控
        if (this.enablePerformanceMonitoring) {
            this.updatePerformanceStats();
        }
    }

    // ========== 公共方法 ==========

    /**
     * 添加精灵到LOD管理
     * @param sprite 精灵组件
     * @param svgContent SVG内容
     * @param width 宽度
     * @param height 高度
     * @param color 颜色（可选）
     */
    public addSpriteToLOD(sprite: Sprite, svgContent: string, width: number, height: number, color?: string): void {
        if (!sprite || !sprite.node) {
            console.warn("精灵或节点无效");
            return;
        }

        const spriteId = this.generateSpriteId(sprite);

        if (!this.managedSprites.has(spriteId)) {
            const managedSprite: ManagedSprite = {
                sprite,
                node: sprite.node,
                originalSVGContent: svgContent,
                originalWidth: width,
                originalHeight: height,
                originalColor: color,
                currentLODLevel: 0,
                lastUpdateTime: 0,
                distanceToCamera: 0,
                screenSize: 0,
                isVisible: true,
            };

            this.managedSprites.set(spriteId, managedSprite);

            // 初始LOD评估
            this.evaluateAndApplyLOD(spriteId).catch(console.error);

            console.log(`精灵已添加到LOD管理: ${spriteId}`);
        }
    }

    /**
     * 从LOD管理移除精灵
     * @param sprite 精灵组件
     */
    public removeSpriteFromLOD(sprite: Sprite): void {
        const spriteId = this.generateSpriteId(sprite);

        if (this.managedSprites.has(spriteId)) {
            this.managedSprites.delete(spriteId);
            console.log(`精灵已从LOD管理移除: ${spriteId}`);
        }
    }

    /**
     * 强制更新指定精灵的LOD
     * @param sprite 精灵组件
     */
    public async forceUpdateLOD(sprite: Sprite): Promise<void> {
        const spriteId = this.generateSpriteId(sprite);

        if (this.managedSprites.has(spriteId)) {
            await this.evaluateAndApplyLOD(spriteId);
        }
    }

    /**
     * 批量添加精灵到LOD管理
     * @param sprites 精灵数组
     */
    public addSpritesToLOD(
        sprites: Array<{
            sprite: Sprite;
            svgContent: string;
            width: number;
            height: number;
            color?: string;
        }>
    ): void {
        sprites.forEach((spriteData) => {
            this.addSpriteToLOD(spriteData.sprite, spriteData.svgContent, spriteData.width, spriteData.height, spriteData.color);
        });
    }

    /**
     * 获取精灵的当前LOD级别
     * @param sprite 精灵组件
     * @returns LOD级别索引，-1表示未找到
     */
    public getSpriteLODLevel(sprite: Sprite): number {
        const spriteId = this.generateSpriteId(sprite);
        const managedSprite = this.managedSprites.get(spriteId);

        return managedSprite ? managedSprite.currentLODLevel : -1;
    }

    /**
     * 获取LOD级别信息
     * @param levelIndex LOD级别索引
     * @returns LOD级别信息
     */
    public getLODLevelInfo(levelIndex: number): LODLevel | null {
        if (levelIndex >= 0 && levelIndex < this.lodLevels.length) {
            return this.lodLevels[levelIndex];
        }
        return null;
    }

    /**
     * 获取性能统计
     */
    public getPerformanceStats(): typeof this.performanceStats {
        // 更新统计
        this.performanceStats.totalSprites = this.managedSprites.size;

        let high = 0,
            medium = 0,
            low = 0,
            veryLow = 0;

        this.managedSprites.forEach((sprite) => {
            switch (sprite.currentLODLevel) {
                case 0:
                    high++;
                    break;
                case 1:
                    medium++;
                    break;
                case 2:
                    low++;
                    break;
                case 3:
                    veryLow++;
                    break;
            }
        });

        this.performanceStats.highDetailCount = high;
        this.performanceStats.mediumDetailCount = medium;
        this.performanceStats.lowDetailCount = low;
        this.performanceStats.veryLowDetailCount = veryLow;

        return { ...this.performanceStats };
    }

    /**
     * 设置LOD级别配置
     * @param levels 新的LOD级别配置
     */
    public setLODLevels(levels: LODLevel[]): void {
        if (levels.length > 0) {
            this.lodLevels = levels;
            console.log("LOD级别配置已更新");

            // 重新评估所有精灵
            this.updateLODForAllSprites();
        }
    }

    /**
     * 优化特定区域内的精灵
     * @param center 中心位置
     * @param radius 半径
     */
    public async optimizeArea(center: Vec3, radius: number): Promise<void> {
        const promises: Promise<void>[] = [];

        this.managedSprites.forEach((sprite, spriteId) => {
            if (sprite.node && sprite.node.isValid) {
                const spritePos = sprite.node.worldPosition;
                const distance = spritePos.subtract(center).length();

                if (distance <= radius) {
                    promises.push(this.optimizeSpriteLOD(spriteId));
                }
            }
        });

        await Promise.all(promises);
    }

    // ========== 私有方法 ==========

    /**
     * 初始化LOD管理器
     */
    private initializeLODManager(): void {
        this.managedSprites.clear();
        this.pendingUpdates.clear();
        this.updateQueue = [];
        this.updateTimer = 0;

        // 获取主相机
        this.camera = director.getScene()?.getComponentInChildren(Camera) || null;

        console.log("SVGLODManager 初始化完成");
    }

    /**
     * 清理LOD管理器
     */
    private cleanupLODManager(): void {
        this.managedSprites.clear();
        this.pendingUpdates.clear();
        this.updateQueue = [];

        console.log("SVGLODManager 清理完成");
    }

    /**
     * 生成精灵ID
     */
    private generateSpriteId(sprite: Sprite): string {
        return `${sprite.node?.uuid || "unknown"}_${sprite.uuid}`;
    }

    /**
     * 更新所有精灵的LOD
     */
    private updateLODForAllSprites(): void {
        if (!this.enableLOD) return;

        this.managedSprites.forEach((sprite, spriteId) => {
            // 检查是否需要更新
            const currentTime = Date.now() / 1000;
            const timeSinceLastUpdate = currentTime - sprite.lastUpdateTime;
            const lodLevel = this.lodLevels[sprite.currentLODLevel];

            if (timeSinceLastUpdate >= lodLevel.updateInterval) {
                this.pendingUpdates.add(spriteId);
            }
        });
    }

    /**
     * 处理待更新精灵
     */
    private processPendingUpdates(): void {
        if (this.pendingUpdates.size === 0) return;

        // 将待更新精灵添加到队列
        this.pendingUpdates.forEach((spriteId) => {
            if (!this.updateQueue.includes(spriteId)) {
                this.updateQueue.push(spriteId);
            }
        });
        this.pendingUpdates.clear();

        // 处理队列中的精灵（限制并发数量）
        const concurrentLimit = Math.min(this.maxConcurrentUpdates, this.updateQueue.length);

        for (let i = 0; i < concurrentLimit; i++) {
            const spriteId = this.updateQueue.shift();
            if (spriteId) {
                this.evaluateAndApplyLOD(spriteId).catch(console.error);
            }
        }
    }

    /**
     * 评估并应用LOD
     */
    private async evaluateAndApplyLOD(spriteId: string): Promise<void> {
        const managedSprite = this.managedSprites.get(spriteId);
        if (!managedSprite || !managedSprite.sprite.isValid) {
            return;
        }

        try {
            // 评估LOD级别
            const lodLevelIndex = this.evaluateLODLevel(managedSprite);

            // 如果LOD级别发生变化，应用新的LOD
            if (lodLevelIndex !== managedSprite.currentLODLevel) {
                await this.applyLODLevel(spriteId, lodLevelIndex);
                managedSprite.currentLODLevel = lodLevelIndex;
            }

            // 更新最后更新时间
            managedSprite.lastUpdateTime = Date.now() / 1000;
        } catch (error) {
            console.error(`评估LOD失败 (${spriteId}):`, error);
        }
    }

    /**
     * 评估LOD级别
     */
    private evaluateLODLevel(sprite: ManagedSprite): number {
        if (!this.camera || !sprite.node) {
            return 0; // 默认最高细节
        }

        // 计算距离
        const cameraPos = this.camera.node?.worldPosition || new Vec3(0, 0, 0);
        const spritePos = sprite.node.worldPosition;
        sprite.distanceToCamera = spritePos.subtract(cameraPos).length();

        // 计算屏幕尺寸
        sprite.screenSize = this.calculateScreenSize(sprite);

        // 检查可见性
        sprite.isVisible = this.isSpriteVisible(sprite);

        if (!sprite.isVisible) {
            return this.lodLevels.length - 1; // 不可见时使用最低细节
        }

        // 根据距离和屏幕尺寸确定LOD级别
        for (let i = 0; i < this.lodLevels.length; i++) {
            const level = this.lodLevels[i];

            if (sprite.distanceToCamera <= level.distanceThreshold && sprite.screenSize >= level.screenSizeThreshold) {
                return i;
            }
        }

        // 如果都不满足，返回最低细节级别
        return this.lodLevels.length - 1;
    }

    /**
     * 计算屏幕尺寸
     */
    private calculateScreenSize(sprite: ManagedSprite): number {
        if (!this.camera || !sprite.node) {
            return sprite.originalWidth * sprite.originalHeight;
        }

        // 简化实现：使用节点尺寸
        const uiTransform = sprite.node.getComponent(UITransform);
        if (uiTransform) {
            return uiTransform.width * uiTransform.height;
        }

        return sprite.originalWidth * sprite.originalHeight;
    }

    /**
     * 检查精灵是否可见
     */
    private isSpriteVisible(sprite: ManagedSprite): boolean {
        if (!sprite.node) return false;

        // 简化实现：检查节点是否激活且在场景中
        return sprite.node.active && sprite.node.isValid;
    }

    /**
     * 应用LOD级别
     */
    private async applyLODLevel(spriteId: string, lodLevelIndex: number): Promise<void> {
        const managedSprite = this.managedSprites.get(spriteId);
        if (!managedSprite || !managedSprite.sprite.isValid) {
            return;
        }

        const lodLevel = this.lodLevels[lodLevelIndex];
        if (!lodLevel) {
            console.warn(`无效的LOD级别: ${lodLevelIndex}`);
            return;
        }

        try {
            // 计算简化后的尺寸
            const simplifiedWidth = Math.max(1, Math.floor(managedSprite.originalWidth * lodLevel.simplifyFactor));
            const simplifiedHeight = Math.max(1, Math.floor(managedSprite.originalHeight * lodLevel.simplifyFactor));

            // 获取简化后的SVG精灵帧
            const spriteFrame = await SVGSpriteCache.getSVGSpriteFrame(
                managedSprite.originalSVGContent,
                simplifiedWidth,
                simplifiedHeight,
                managedSprite.originalColor,
                lodLevel.quality
            );

            if (spriteFrame && managedSprite.sprite.isValid) {
                managedSprite.sprite.spriteFrame = spriteFrame;

                console.log(`LOD更新: ${spriteId} -> ${lodLevel.name} (${simplifiedWidth}x${simplifiedHeight})`);
            }
        } catch (error) {
            console.error(`应用LOD级别失败 (${spriteId}):`, error);
        }
    }

    /**
     * 优化精灵LOD
     */
    private async optimizeSpriteLOD(spriteId: string): Promise<void> {
        const managedSprite = this.managedSprites.get(spriteId);
        if (!managedSprite) return;

        // 重新评估LOD级别
        const newLodLevel = this.evaluateLODLevel(managedSprite);

        // 如果当前级别不是最优，应用新的LOD级别
        if (newLodLevel !== managedSprite.currentLODLevel) {
            await this.applyLODLevel(spriteId, newLodLevel);
            managedSprite.currentLODLevel = newLodLevel;
        }
    }

    /**
     * 更新性能统计
     */
    private updatePerformanceStats(): void {
        const stats = this.getPerformanceStats();

        // 定期输出性能信息
        const currentTime = Date.now() / 1000;
        if (currentTime - this.performanceStats.lastUpdateTime >= 5) {
            // 每5秒输出一次
            console.log(`LOD性能统计:
                总精灵数: ${stats.totalSprites}
                高细节: ${stats.highDetailCount}
                中细节: ${stats.mediumDetailCount}
                低细节: ${stats.lowDetailCount}
                极低细节: ${stats.veryLowDetailCount}
            `);

            this.performanceStats.lastUpdateTime = currentTime;
        }
    }
}
