"use strict";
/**
 * SVG资源属性检查器
 * 用于在属性检查器中显示和编辑SVG资源的属性
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.template = exports.$ = void 0;
exports.update = update;
exports.ready = ready;
exports.close = close;
exports.$ = {
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
exports.template = `
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
function update(assetList, metaList) {
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
function ready() {
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
function close() {
    // 清理工作
}
// 属性变化处理方法
function onPropertyChange(property, value) {
    if (!this.metaList || this.metaList.length === 0) {
        return;
    }
    // 更新所有选中的meta
    this.metaList.forEach((meta) => {
        if (meta.userData) {
            meta.userData[property] = value;
            meta.userData.isDirty = true;
            meta.userData.lastModified = Date.now();
        }
    });
    // 通知属性检查器数据已更改
    this.dispatch("change");
}
// 使用类型断言来扩展原型
onPropertyChange.prototype = onPropertyChange;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ZnLWFzc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL2NvbnRyaWJ1dGlvbnMvaW5zcGVjdG9yL3N2Zy1hc3NldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUF1SEgsd0JBK0JDO0FBRUQsc0JBV0M7QUFFRCxzQkFFQztBQTlKWSxRQUFBLENBQUMsR0FBRztJQUNiLFVBQVUsRUFBRSxjQUFjO0lBQzFCLEtBQUssRUFBRSxRQUFRO0lBQ2YsTUFBTSxFQUFFLFNBQVM7SUFDakIsWUFBWSxFQUFFLGdCQUFnQjtJQUM5QixLQUFLLEVBQUUsUUFBUTtJQUNmLFdBQVcsRUFBRSxjQUFjO0lBQzNCLE1BQU0sRUFBRSxTQUFTO0lBQ2pCLE9BQU8sRUFBRSxVQUFVO0lBQ25CLFdBQVcsRUFBRSxlQUFlO0lBQzVCLFNBQVMsRUFBRSxZQUFZO0lBQ3ZCLGVBQWUsRUFBRSxtQkFBbUI7SUFDcEMsVUFBVSxFQUFFLGNBQWM7Q0FDN0IsQ0FBQztBQUVXLFFBQUEsUUFBUSxHQUFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBMkZ2QixDQUFDO0FBSUYsU0FBZ0IsTUFBTSxDQUFrQixTQUFnQixFQUFFLFFBQWU7SUFDckUsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7SUFDM0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFFekIsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNqRCxPQUFPO0lBQ1gsQ0FBQztJQUVELE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7SUFFdEMsU0FBUztJQUNULElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQztJQUN6QyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7SUFDM0MsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxZQUFZLElBQUksU0FBUyxDQUFDO0lBQy9ELElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQztJQUNyRCxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLFNBQVMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUV0RixRQUFRO0lBQ1IsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO0lBQzFDLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQztJQUN0RCxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUM7SUFDNUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO0lBRTlDLFVBQVU7SUFDVixJQUFJLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLGVBQWUsSUFBSSxDQUFDLENBQUM7SUFDN0QsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxVQUFVLElBQUksS0FBSyxDQUFDO0lBRXZELHFCQUFxQjtJ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USxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQy9DLE9BQU87SUFDWCxDQUFDO0lBRUQsY0FBYztJQUNkLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUU7UUFDaEMsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDaEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1lBQzdCLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM1QyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxlQUFlO0lBQ2YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUM1QixDQUFDO0FBU0QsY0FBYztBQUNiLGdCQUF3QixDQUFDLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBTVkfotYTmupDlsZ7mgKfmo4Dmn6XlmahcclxuICog55So5LqO5Zyo5bGe5oCn5qOA5p+l5Zmo5Lit5pi+56S65ZKM57yW6L6RU1ZH6LWE5rqQ55qE5bGe5oCnXHJcbiAqL1xyXG5cclxudHlwZSBTZWxlY3RvcjwkPiA9IHsgJDogUmVjb3JkPGtleW9mICQsIGFueSB8IG51bGw+IH0gJiB7XHJcbiAgICBkaXNwYXRjaChzdHI6IHN0cmluZyk6IHZvaWQ7XHJcbiAgICBhc3NldExpc3Q6IGFueVtdO1xyXG4gICAgbWV0YUxpc3Q6IGFueVtdO1xyXG4gICAgb25Qcm9wZXJ0eUNoYW5nZShwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KTogdm9pZDtcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCAkID0ge1xyXG4gICAgc3ZnQ29udGVudDogXCIuc3ZnLWNvbnRlbnRcIixcclxuICAgIHdpZHRoOiBcIi53aWR0aFwiLFxyXG4gICAgaGVpZ2h0OiBcIi5oZWlnaHRcIixcclxuICAgIGRlZmF1bHRDb2xvcjogXCIuZGVmYXVsdC1jb2xvclwiLFxyXG4gICAgdGl0bGU6IFwiLnRpdGxlXCIsXHJcbiAgICBkZXNjcmlwdGlvbjogXCIuZGVzY3JpcHRpb25cIixcclxuICAgIGF1dGhvcjogXCIuYXV0aG9yXCIsXHJcbiAgICBsaWNlbnNlOiBcIi5saWNlbnNlXCIsXHJcbiAgICByZW5kZXJTY2FsZTogXCIucmVuZGVyLXNjYWxlXCIsXHJcbiAgICBhbnRpYWxpYXM6IFwiLmFudGlhbGlhc1wiLFxyXG4gICAgY29tcGxleGl0eVNjb3JlOiBcIi5jb21wbGV4aXR5LXNjb3JlXCIsXHJcbiAgICBpc0FuaW1hdGVkOiBcIi5pcy1hbmltYXRlZFwiLFxyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IHRlbXBsYXRlID0gYFxyXG48ZGl2IGNsYXNzPVwic3ZnLWFzc2V0LWluc3BlY3RvclwiPlxyXG4gICAgPHVpLXNlY3Rpb24+XHJcbiAgICAgICAgPHVpLWxhYmVsIHNsb3Q9XCJoZWFkZXJcIj5TVkfln7rmnKzkv6Hmga88L3VpLWxhYmVsPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJzZWN0aW9uLWNvbnRlbnRcIj5cclxuICAgICAgICAgICAgPHVpLXByb3A+XHJcbiAgICAgICAgICAgICAgICA8dWktbGFiZWwgc2xvdD1cImxhYmVsXCI+5a695bqmPC91aS1sYWJlbD5cclxuICAgICAgICAgICAgICAgIDx1aS1udW0taW5wdXQgc2xvdD1cImNvbnRlbnRcIiBjbGFzcz1cIndpZHRoXCIgc3RlcD1cIjFcIj48L3VpLW51bS1pbnB1dD5cclxuICAgICAgICAgICAgPC91aS1wcm9wPlxyXG4gICAgICAgICAgICA8dWktcHJvcD5cclxuICAgICAgICAgICAgICAgIDx1aS1sYWJlbCBzbG90PVwibGFiZWxcIj7pq5jluqY8L3VpLWxhYmVsPlxyXG4gICAgICAgICAgICAgICAgPHVpLW51bS1pbnB1dCBzbG90PVwiY29udGVudFwiIGNsYXNzPVwiaGVpZ2h0XCIgc3RlcD1cIjFcIj48L3VpLW51bS1pbnB1dD5cclxuICAgICAgICAgICAgPC91aS1wcm9wPlxyXG4gICAgICAgICAgICA8dWktcHJvcD5cclxuICAgICAgICAgICAgICAgIDx1aS1sYWJlbCBzbG90PVwibGFiZWxcIj7pu5jorqTpopzoibI8L3VpLWxhYmVsPlxyXG4gICAgICAgICAgICAgICAgPHVpLWNvbG9yIHNsb3Q9XCJjb250ZW50XCIgY2xhc3M9XCJkZWZhdWx0LWNvbG9yXCI+PC91aS1jb2xvcj5cclxuICAgICAgICAgICAgPC91aS1wcm9wPlxyXG4gICAgICAgICAgICA8dWktcHJvcD5cclxuICAgICAgICAgICAgICAgIDx1aS1sYWJlbCBzbG90PVwibGFiZWxcIj7muLLmn5PnvKnmlL48L3VpLWxhYmVsPlxyXG4gICAgICAgICAgICAgICAgPHVpLW51bS1pbnB1dCBzbG90PVwiY29udGVudFwiIGNsYXNzPVwicmVuZGVyLXNjYWxlXCIgc3RlcD1cIjAuMVwiIG1pbj1cIjAuMVwiIG1heD1cIjEwXCI+PC91aS1udW0taW5wdXQ+XHJcbiAgICAgICAgICAgIDwvdWktcHJvcD5cclxuICAgICAgICAgICAgPHVpLXByb3A+XHJcbiAgICAgICAgICAgICAgICA8dWktbGFiZWwgc2xvdD1cImxhYmVsXCI+5oqX6ZSv6b2/PC91aS1sYWJlbD5cclxuICAgICAgICAgICAgICAgIDx1aS1jaGVja2JveCBzbG90PVwiY29udGVudFwiIGNsYXNzPVwiYW50aWFsaWFzXCI+PC91aS1jaGVja2JveD5cclxuICAgICAgICAgICAgPC91aS1wcm9wPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgPC91aS1zZWN0aW9uPlxyXG5cclxuICAgIDx1aS1zZWN0aW9uPlxyXG4gICAgICAgIDx1aS1sYWJlbCBzbG90PVwiaGVhZGVyXCI+5YWD5pWw5o2uPC91aS1sYWJlbD5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwic2VjdGlvbi1jb250ZW50XCI+XHJcbiAgICAgICAgICAgIDx1aS1wcm9wPlxyXG4gICAgICAgICAgICAgICAgPHVpLWxhYmVsIHNsb3Q9XCJsYWJlbFwiPuagh+mimDwvdWktbGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8dWktaW5wdXQgc2xvdD1cImNvbnRlbnRcIiBjbGFzcz1cInRpdGxlXCI+PC91aS1pbnB1dD5cclxuICAgICAgICAgICAgPC91aS1wcm9wPlxyXG4gICAgICAgICAgICA8dWktcHJvcD5cclxuICAgICAgICAgICAgICAgIDx1aS1sYWJlbCBzbG90PVwibGFiZWxcIj7mj4/ov7A8L3VpLWxhYmVsPlxyXG4gICAgICAgICAgICAgICAgPHVpLXRleHRhcmVhIHNsb3Q9XCJjb250ZW50XCIgY2xhc3M9XCJkZXNjcmlwdGlvblwiIHJvd3M9XCIzXCI+PC91aS10ZXh0YXJlYT5cclxuICAgICAgICAgICAgPC91aS1wcm9wPlxyXG4gICAgICAgICAgICA8dWktcHJvcD5cclxuICAgICAgICAgICAgICAgIDx1aS1sYWJlbCBzbG90PVwibGFiZWxcIj7kvZzogIU8L3VpLWxhYmVsPlxyXG4gICAgICAgICAgICAgICAgPHVpLWlucHV0IHNsb3Q9XCJjb250ZW50XCIgY2xhc3M9XCJhdXRob3JcIj48L3VpLWlucHV0PlxyXG4gICAgICAgICAgICA8L3VpLXByb3A+XHJcbiAgICAgICAgICAgIDx1aS1wcm9wPlxyXG4gICAgICAgICAgICAgICAgPHVpLWxhYmVsIHNsb3Q9XCJsYWJlbFwiPuiuuOWPr+ivgTwvdWktbGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8dWktaW5wdXQgc2xvdD1cImNvbnRlbnRcIiBjbGFzcz1cImxpY2Vuc2VcIj48L3VpLWlucHV0PlxyXG4gICAgICAgICAgICA8L3VpLXByb3A+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICA8L3VpLXNlY3Rpb24+XHJcblxyXG4gICAgPHVpLXNlY3Rpb24+XHJcbiAgICAgICAgPHVpLWxhYmVsIHNsb3Q9XCJoZWFkZXJcIj5TVkfkv6Hmga88L3VpLWxhYmVsPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJzZWN0aW9uLWNvbnRlbnRcIj5cclxuICAgICAgICAgICAgPHVpLXByb3A+XHJcbiAgICAgICAgICAgICAgICA8dWktbGFiZWwgc2xvdD1cImxhYmVsXCI+5aSN5p2C5bqm6K+E5YiGPC91aS1sYWJlbD5cclxuICAgICAgICAgICAgICAgIDx1aS1udW0taW5wdXQgc2xvdD1cImNvbnRlbnRcIiBjbGFzcz1cImNvbXBsZXhpdHktc2NvcmVcIiBzdGVwPVwiMVwiIHJlYWRvbmx5PjwvdWktbnVtLWlucHV0PlxyXG4gICAgICAgICAgICA8L3VpLXByb3A+XHJcbiAgICAgICAgICAgIDx1aS1wcm9wPlxyXG4gICAgICAgICAgICAgICAgPHVpLWxhYmVsIHNsb3Q9XCJsYWJlbFwiPuWMheWQq+WKqOeUuzwvdWktbGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8dWktY2hlY2tib3ggc2xvdD1cImNvbnRlbnRcIiBjbGFzcz1cImlzLWFuaW1hdGVkXCIgcmVhZG9ubHk+PC91aS1jaGVja2JveD5cclxuICAgICAgICAgICAgPC91aS1wcm9wPlxyXG4gICAgICAgICAgICA8dWktcHJvcD5cclxuICAgICAgICAgICAgICAgIDx1aS1sYWJlbCBzbG90PVwibGFiZWxcIj5TVkflhoXlrrk8L3VpLWxhYmVsPlxyXG4gICAgICAgICAgICAgICAgPHVpLXRleHRhcmVhIHNsb3Q9XCJjb250ZW50XCIgY2xhc3M9XCJzdmctY29udGVudFwiIHJvd3M9XCIxMFwiIHJlYWRvbmx5PjwvdWktdGV4dGFyZWE+XHJcbiAgICAgICAgICAgIDwvdWktcHJvcD5cclxuICAgICAgICA8L2Rpdj5cclxuICAgIDwvdWktc2VjdGlvbj5cclxuPC9kaXY+XHJcblxyXG48c3R5bGU+XHJcbi5zdmctYXNzZXQtaW5zcGVjdG9yIHtcclxuICAgIHBhZGRpbmc6IDEwcHg7XHJcbn1cclxuXHJcbi5zZWN0aW9uLWNvbnRlbnQge1xyXG4gICAgcGFkZGluZzogMTBweDtcclxufVxyXG5cclxudWktc2VjdGlvbiB7XHJcbiAgICBtYXJnaW4tYm90dG9tOiAxNXB4O1xyXG59XHJcblxyXG51aS1wcm9wIHtcclxuICAgIG1hcmdpbi1ib3R0b206IDhweDtcclxufVxyXG5cclxudWktdGV4dGFyZWEge1xyXG4gICAgZm9udC1mYW1pbHk6IG1vbm9zcGFjZTtcclxuICAgIGZvbnQtc2l6ZTogMTJweDtcclxufVxyXG48L3N0eWxlPlxyXG5gO1xyXG5cclxudHlwZSBQYW5lbFRoaXMgPSBTZWxlY3Rvcjx0eXBlb2YgJD47XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlKHRoaXM6IFBhbmVsVGhpcywgYXNzZXRMaXN0OiBhbnlbXSwgbWV0YUxpc3Q6IGFueVtdKSB7XHJcbiAgICB0aGlzLmFzc2V0TGlzdCA9IGFzc2V0TGlzdDtcclxuICAgIHRoaXMubWV0YUxpc3QgPSBtZXRhTGlzdDtcclxuXHJcbiAgICBpZiAobWV0YUxpc3QubGVuZ3RoID09PSAwIHx8ICFtZXRhTGlzdFswXS51c2VyRGF0YSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IG1ldGFMaXN0WzBdLnVzZXJEYXRhO1xyXG5cclxuICAgIC8vIOabtOaWsOWfuuacrOWxnuaAp1xyXG4gICAgdGhpcy4kLndpZHRoLnZhbHVlID0gdXNlckRhdGEud2lkdGggfHwgMDtcclxuICAgIHRoaXMuJC5oZWlnaHQudmFsdWUgPSB1c2VyRGF0YS5oZWlnaHQgfHwgMDtcclxuICAgIHRoaXMuJC5kZWZhdWx0Q29sb3IudmFsdWUgPSB1c2VyRGF0YS5kZWZhdWx0Q29sb3IgfHwgXCIjZmZmZmZmXCI7XHJcbiAgICB0aGlzLiQucmVuZGVyU2NhbGUudmFsdWUgPSB1c2VyRGF0YS5yZW5kZXJTY2FsZSB8fCAxO1xyXG4gICAgdGhpcy4kLmFudGlhbGlhcy52YWx1ZSA9IHVzZXJEYXRhLmFudGlhbGlhcyAhPT0gdW5kZWZpbmVkID8gdXNlckRhdGEuYW50aWFsaWFzIDogdHJ1ZTtcclxuXHJcbiAgICAvLyDmm7TmlrDlhYPmlbDmja5cclxuICAgIHRoaXMuJC50aXRsZS52YWx1ZSA9IHVzZXJEYXRhLnRpdGxlIHx8IFwiXCI7XHJcbiAgICB0aGlzLiQuZGVzY3JpcHRpb24udmFsdWUgPSB1c2VyRGF0YS5kZXNjcmlwdGlvbiB8fCBcIlwiO1xyXG4gICAgdGhpcy4kLmF1dGhvci52YWx1ZSA9IHVzZXJEYXRhLmF1dGhvciB8fCBcIlwiO1xyXG4gICAgdGhpcy4kLmxpY2Vuc2UudmFsdWUgPSB1c2VyRGF0YS5saWNlbnNlIHx8IFwiXCI7XHJcblxyXG4gICAgLy8g5pu05pawU1ZH5L+h5oGvXHJcbiAgICB0aGlzLiQuY29tcGxleGl0eVNjb3JlLnZhbHVlID0gdXNlckRhdGEuY29tcGxleGl0eVNjb3JlIHx8IDA7XHJcbiAgICB0aGlzLiQuaXNBbmltYXRlZC52YWx1ZSA9IHVzZXJEYXRhLmlzQW5pbWF0ZWQgfHwgZmFsc2U7XHJcblxyXG4gICAgLy8g5pi+56S66YOo5YiGU1ZH5YaF5a6577yI5YmNNTAw5Liq5a2X56ym77yJXHJcbiAgICBjb25zdCBzdmdDb250ZW50ID0gdXNlckRhdGEuc3ZnQ29udGVudCB8fCBcIlwiO1xyXG4gICAgY29uc3QgcHJldmlld0NvbnRlbnQgPSBzdmdDb250ZW50Lmxlbmd0aCA+IDUwMCA/IHN2Z0NvbnRlbnQuc3Vic3RyaW5nKDAsIDUwMCkgKyBcIi4uLlwiIDogc3ZnQ29udGVudDtcclxuICAgIHRoaXMuJC5zdmdDb250ZW50LnZhbHVlID0gcHJldmlld0NvbnRlbnQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkeSh0aGlzOiBQYW5lbFRoaXMpIHtcclxuICAgIC8vIOebkeWQrOWxnuaAp+WPmOWMllxyXG4gICAgdGhpcy4kLndpZHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJjb25maXJtXCIsICgpID0+IHRoaXMub25Qcm9wZXJ0eUNoYW5nZShcIndpZHRoXCIsIHRoaXMuJC53aWR0aC52YWx1ZSkpO1xyXG4gICAgdGhpcy4kLmhlaWdodC5hZGRFdmVudExpc3RlbmVyKFwiY29uZmlybVwiLCAoKSA9PiB0aGlzLm9uUHJvcGVydHlDaGFuZ2UoXCJoZWlnaHRcIiwgdGhpcy4kLmhlaWdodC52YWx1ZSkpO1xyXG4gICAgdGhpcy4kLmRlZmF1bHRDb2xvci5hZGRFdmVudExpc3RlbmVyKFwiY29uZmlybVwiLCAoKSA9PiB0aGlzLm9uUHJvcGVydHlDaGFuZ2UoXCJkZWZhdWx0Q29sb3JcIiwgdGhpcy4kLmRlZmF1bHRDb2xvci52YWx1ZSkpO1xyXG4gICAgdGhpcy4kLnJlbmRlclNjYWxlLmFkZEV2ZW50TGlzdGVuZXIoXCJjb25maXJtXCIsICgpID0+IHRoaXMub25Qcm9wZXJ0eUNoYW5nZShcInJlbmRlclNjYWxlXCIsIHRoaXMuJC5yZW5kZXJTY2FsZS52YWx1ZSkpO1xyXG4gICAgdGhpcy4kLmFudGlhbGlhcy5hZGRFdmVudExpc3RlbmVyKFwiY29uZmlybVwiLCAoKSA9PiB0aGlzLm9uUHJvcGVydHlDaGFuZ2UoXCJhbnRpYWxpYXNcIiwgdGhpcy4kLmFudGlhbGlhcy52YWx1ZSkpO1xyXG4gICAgdGhpcy4kLnRpdGxlLmFkZEV2ZW50TGlzdGVuZXIoXCJjb25maXJtXCIsICgpID0+IHRoaXMub25Qcm9wZXJ0eUNoYW5nZShcInRpdGxlXCIsIHRoaXMuJC50aXRsZS52YWx1ZSkpO1xyXG4gICAgdGhpcy4kLmRlc2NyaXB0aW9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjb25maXJtXCIsICgpID0+IHRoaXMub25Qcm9wZXJ0eUNoYW5nZShcImRlc2NyaXB0aW9uXCIsIHRoaXMuJC5kZXNjcmlwdGlvbi52YWx1ZSkpO1xyXG4gICAgdGhpcy4kLmF1dGhvci5hZGRFdmVudExpc3RlbmVyKFwiY29uZmlybVwiLCAoKSA9PiB0aGlzLm9uUHJvcGVydHlDaGFuZ2UoXCJhdXRob3JcIiwgdGhpcy4kLmF1dGhvci52YWx1ZSkpO1xyXG4gICAgdGhpcy4kLmxpY2Vuc2UuYWRkRXZlbnRMaXN0ZW5lcihcImNvbmZpcm1cIiwgKCkgPT4gdGhpcy5vblByb3BlcnR5Q2hhbmdlKFwibGljZW5zZVwiLCB0aGlzLiQubGljZW5zZS52YWx1ZSkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2xvc2UodGhpczogUGFuZWxUaGlzKSB7XHJcbiAgICAvLyDmuIXnkIblt6XkvZxcclxufVxyXG5cclxuLy8g5bGe5oCn5Y+Y5YyW5aSE55CG5pa55rOVXHJcbmZ1bmN0aW9uIG9uUHJvcGVydHlDaGFuZ2UodGhpczogUGFuZWxUaGlzLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XHJcbiAgICBpZiAoIXRoaXMubWV0YUxpc3QgfHwgdGhpcy5tZXRhTGlzdC5sZW5ndGggPT09IDApIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8g5pu05paw5omA5pyJ6YCJ5Lit55qEbWV0YVxyXG4gICAgdGhpcy5tZXRhTGlzdC5mb3JFYWNoKChtZXRhOiBhbnkpID0+IHtcclxuICAgICAgICBpZiAobWV0YS51c2VyRGF0YSkge1xyXG4gICAgICAgICAgICBtZXRhLnVzZXJEYXRhW3Byb3BlcnR5XSA9IHZhbHVlO1xyXG4gICAgICAgICAgICBtZXRhLnVzZXJEYXRhLmlzRGlydHkgPSB0cnVlO1xyXG4gICAgICAgICAgICBtZXRhLnVzZXJEYXRhLmxhc3RNb2RpZmllZCA9IERhdGUubm93KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g6YCa55+l5bGe5oCn5qOA5p+l5Zmo5pWw5o2u5bey5pu05pS5XHJcbiAgICB0aGlzLmRpc3BhdGNoKFwiY2hhbmdlXCIpO1xyXG59XHJcblxyXG4vLyDlsIbmlrnms5Xnu5HlrprliLBQYW5lbFRoaXPljp/lnotcclxuZGVjbGFyZSBnbG9iYWwge1xyXG4gICAgaW50ZXJmYWNlIFBhbmVsVGhpc1Byb3RvIHtcclxuICAgICAgICBvblByb3BlcnR5Q2hhbmdlKHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiB2b2lkO1xyXG4gICAgfVxyXG59XHJcblxyXG4vLyDkvb/nlKjnsbvlnovmlq3oqIDmnaXmianlsZXljp/lnotcclxuKG9uUHJvcGVydHlDaGFuZ2UgYXMgYW55KS5wcm90b3R5cGUgPSBvblByb3BlcnR5Q2hhbmdlO1xyXG4iXX0=