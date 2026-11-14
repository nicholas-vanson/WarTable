shader_type canvas_item;
render_mode unshaded;

uniform sampler2D wood_color : source_color, filter_linear;
uniform sampler2D wood_normal : filter_linear;
uniform sampler2D wood_roughness : filter_linear;

void fragment() {
	vec2 point = fract(UV * vec2(1.7, 0.85));
	vec2 lamp = vec2(0.38 + sin(TIME * 0.26) * 0.027, 0.15);
	vec2 delta = (UV - lamp) * vec2(1.45, 0.9);
	vec3 normal = normalize(vec3((texture(wood_normal, point).xy * 2.0 - 1.0) * 0.5, 1.0));
	vec3 light = normalize(vec3(-delta, 0.32));
	float diffuse = max(dot(normal, light), 0.0);
	float roughness = texture(wood_roughness, point).r;
	float reflectance = pow(max(dot(normal, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), mix(38.0, 5.0, roughness));
	float intensity = exp(-4.8 * dot(delta, delta));
	vec3 timber = texture(wood_color, point).rgb * vec3(0.53, 0.43, 0.34);
	vec3 lit = timber * (0.40 + intensity * diffuse * 0.77) + vec3(0.94, 0.70, 0.40) * reflectance * intensity * 0.07;
	COLOR = vec4(lit, 1.0);
}
