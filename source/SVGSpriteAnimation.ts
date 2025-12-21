import { _decorator, Component, Sprite, SpriteFrame, Texture2D, ImageAsset, UITransform } from "cc";
const { ccclass, property, executeInEditMode, requireComponent, menu } = _decorator;

import SVG from "svg.js";
import { interpolate } from "flubber";

@ccclass("SVGSpriteAnimation")
@menu("2D/SVGSpriteAnimation")
@executeInEditMode
@requireComponent(Sprite)
export class SVGSpriteAnimation extends Component {
    @property(Sprite)
    private sprite: Sprite = null!;

    @property({ type: [String] })
    private svgPaths: string[] = []; // 存储多个SVG路径字符串 (M0,0 L100,0...)

    @property
    private duration: number = 2.0; // 动画总时长（秒）

    @property
    private isPlaying: boolean = false;

    @property
    private isLooping: boolean = false;

    private svgCanvas: SVG.Doc = null!;
    private currentPathElement: SVG.Path = null!;
    private interpolator: ((t: number) => string) | null = null;
    private animationProgress: number = 0;
    private currentShapeIndex: number = 0;

    // 用于离屏渲染的Canvas
    private offscreenCanvas: HTMLCanvasElement = null!;
    private offscreenCtx: CanvasRenderingContext2D = null!;

    onLoad() {
        this.sprite = this.getComponent(Sprite)!;
        this.initOffscreenCanvas();
        this.initSVG();
        if (this.isPlaying) {
            this.play();
        }
    }

    private initOffscreenCanvas() {
        const uiTrans = this.getComponent(UITransform);
        if (!uiTrans) return false;
        this.offscreenCanvas = document.createElement("canvas");
        this.offscreenCanvas.width = uiTrans.width;
        this.offscreenCanvas.height = uiTrans.height;
        this.offscreenCtx = this.offscreenCanvas.getContext("2d")!;
    }

    private initSVG() {
        // 在内存中创建一个SVG.js画布，不挂载到DOM
        const dummyDiv = document.createElement("div");
        this.svgCanvas = SVG(dummyDiv) as SVG.Doc;
        this.svgCanvas.size(this.offscreenCanvas.width, this.offscreenCanvas.height);

        if (this.svgPaths.length > 0) {
            // 创建初始路径
            this.currentPathElement = this.svgCanvas.path(this.svgPaths[0]).fill("#ff0000");
            this.setupInterpolation(0, 1);
        }
    }

    // 设置从形状A到形状B的插值器
    private setupInterpolation(fromIndex: number, toIndex: number) {
        if (this.svgPaths.length < 2) {
            console.warn("至少需要两个SVG路径才能创建动画。");
            return;
        }
        const pathA = this.svgPaths[fromIndex];
        const pathB = this.svgPaths[toIndex];

        // 使用Flubber创建插值器核心[citation:1][citation:3]
        try {
            this.interpolator = interpolate(pathA, pathB, {
                maxSegmentLength: 2, // 控制平滑度与性能
            });
        } catch (error) {
            console.error("创建形状插值器失败，请检查SVG路径格式:", error);
        }
    }

    public play() {
        this.isPlaying = true;
        this.animationProgress = 0;
        this.currentShapeIndex = 0;
        if (this.svgPaths.length > 1) {
            this.setupInterpolation(0, 1);
        }
        this.schedule(this.updateAnimation, 0);
    }

    public stop() {
        this.isPlaying = false;
        this.unschedule(this.updateAnimation);
    }

    private updateAnimation(deltaTime: number) {
        if (!this.isPlaying || !this.interpolator) return;

        // 更新进度
        this.animationProgress += deltaTime / this.duration;

        let t = this.animationProgress;
        let targetShapeIndex = this.currentShapeIndex + 1;

        // 处理循环和下一个形状的过渡
        if (t >= 1.0) {
            if (this.isLooping) {
                this.currentShapeIndex = (this.currentShapeIndex + 1) % this.svgPaths.length;
                targetShapeIndex = (this.currentShapeIndex + 1) % this.svgPaths.length;
                this.animationProgress = 0;
                t = 0;
                this.setupInterpolation(this.currentShapeIndex, targetShapeIndex);
            } else {
                this.animationProgress = 1.0;
                t = 1.0;
                this.isPlaying = false; // 播放完毕
            }
        }

        // 使用Flubber插值器获取当前中间帧的路径数据[citation:1]
        const currentPathData = this.interpolator(t);

        // 使用SVG.js更新路径[citation:4]
        this.currentPathElement.plot(currentPathData);

        // 将SVG渲染到离屏Canvas，再更新到Cocos SpriteFrame
        this.renderSVGToCanvasAndUpdateTexture();
    }

    private renderSVGToCanvasAndUpdateTexture() {
        // 清空画布
        this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

        // 关键：将SVG.js生成的SVG字符串，渲染到2D Canvas上
        const svgString = this.svgCanvas.svg();
        const DOMURL = window.URL || window.webkitURL;
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = DOMURL.createObjectURL(svgBlob);

        img.onload = () => {
            this.offscreenCtx.drawImage(img, 0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
            DOMURL.revokeObjectURL(url);
            this.updateSpriteTexture();
        };
        img.src = url;
    }

    private updateSpriteTexture() {
        // 从Canvas创建ImageAsset和Texture2D
        const imageAsset = new ImageAsset(this.offscreenCanvas);
        const texture = new Texture2D();
        texture.image = imageAsset;

        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;
        this.sprite.spriteFrame = spriteFrame;
    }

    // 添加一个形状到动画序列
    public addSVGPath(svgPathString: string) {
        this.svgPaths.push(svgPathString);
        if (this.svgPaths.length === 2 && !this.interpolator) {
            this.setupInterpolation(0, 1);
        }
    }

    // 跳转到特定形状并开始向下一形状变形
    public morphToShape(index: number) {
        if (index < 0 || index >= this.svgPaths.length) return;
        const nextIndex = (index + 1) % this.svgPaths.length;
        this.currentShapeIndex = index;
        this.animationProgress = 0;
        this.setupInterpolation(index, nextIndex);
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.schedule(this.updateAnimation, 0);
        }
    }

    onDestroy() {
        this.stop();
        if (this.svgCanvas) {
            this.svgCanvas.clear();
        }
    }
}
