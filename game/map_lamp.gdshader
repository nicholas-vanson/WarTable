shader_type canvas_item;
render_mode unshaded;

uniform vec4 warm : source_color = vec4(0.97, 0.77, 0.43, 1.0);

void fragment() {
	vec2 center = vec2(0.36 + sin(TIME * 0.24) * 0.035, 0.15);
	vec2 delta = (UV - center) * vec2(1.13, 0.96);
	float spot = exp(-4.9 * dot(delta, delta));
	float vignette = smoothstep(0.22, 0.73, length((UV - vec2(0.5, 0.46)) * vec2(0.95, 0.88)));
	float tooth = fract(sin(dot(floor(UV * vec2(1536.0, 840.0)), vec2(127.1, 311.7))) * 43758.5453) - 0.5;
	vec3 tint = mix(vec3(0.035, 0.078, 0.09), warm.rgb, spot * spot);
	COLOR = vec4(tint, clamp(0.075 + 0.20 * vignette + 0.16 * spot + tooth * 0.034, 0.0, 0.30));
}
