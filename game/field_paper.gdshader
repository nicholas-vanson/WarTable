shader_type canvas_item;
render_mode unshaded;

void fragment() {
	vec2 pixel = floor(UV * vec2(900.0, 1400.0));
	float grain = fract(sin(dot(pixel, vec2(12.9898, 78.233))) * 43758.5453);
	float fibers = sin(UV.y * 1100.0 + sin(UV.x * 370.0)) * 0.006;
	COLOR.rgb *= 0.975 + grain * 0.035 + fibers;
}
