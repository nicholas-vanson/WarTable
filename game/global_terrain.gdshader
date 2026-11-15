shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_disabled;

uniform sampler2D height_map : filter_linear, repeat_disable;
uniform sampler2D geography : source_color, filter_linear, repeat_disable;
uniform sampler2D territories : filter_nearest, repeat_disable;
uniform sampler2D control_palette : source_color, filter_nearest, repeat_disable;
uniform sampler2D ground_grain : source_color, filter_linear_mipmap, repeat_enable;
uniform vec2 world_size = vec2(7705.0, 3213.0);
uniform vec2 raster_size = vec2(8192.0, 3416.0);
uniform float relief_height = 180.0;

float normalized_height(vec2 p) { return dot(textureLod(height_map, p, 0.0).rg, vec2(65280.0, 255.0)) / 65535.0; }
float altitude(vec2 p) { return normalized_height(p) * relief_height; }

void vertex() {
	vec2 step_uv = 1.0 / raster_size;
	VERTEX.y = altitude(UV);
	float dx = (altitude(UV + vec2(step_uv.x, 0.0)) - altitude(UV - vec2(step_uv.x, 0.0))) / (2.0 * world_size.x / raster_size.x);
	float dz = (altitude(UV + vec2(0.0, step_uv.y)) - altitude(UV - vec2(0.0, step_uv.y))) / (2.0 * world_size.y / raster_size.y);
	NORMAL = normalize(vec3(-dx, 1.0, -dz));
}

void fragment() {
	vec4 territory = texture(territories, UV);
	float ident = round(territory.r * 255.0) + round(territory.g * 255.0) * 256.0;
	vec4 owner = texture(control_palette, vec2((ident + 0.5) / 512.0, 0.25));
	vec4 markers = texture(control_palette, vec2((ident + 0.5) / 512.0, 0.75));
	vec3 state = markers.rgb * markers.a;
	vec3 base = texture(geography, UV).rgb;
	vec2 texel = 2.5 / raster_size;
	float dx = (altitude(UV + vec2(texel.x, 0.0)) - altitude(UV - vec2(texel.x, 0.0))) / (5.0 * world_size.x / raster_size.x);
	float dz = (altitude(UV + vec2(0.0, texel.y)) - altitude(UV - vec2(0.0, texel.y))) / (5.0 * world_size.y / raster_size.y);
	NORMAL = normalize((VIEW_MATRIX * vec4(normalize(vec3(-dx, 1.0, -dz)), 0.0)).xyz);
	// Transparent at the territory center; strongest just inside its boundary.
	float wash = pow(1.0 - smoothstep(0.0, 0.68, territory.b), 1.35) * 0.43 * owner.a;
	base = mix(base, owner.rgb, wash);
	float edge_distance = territory.a * 16.0;
	bool land = texture(height_map, UV).b > 0.5;
	// Crisp vector outlines are projected from the authoritative polygons above
	// this surface, rather than enlarged from this lower-resolution ID raster.
	float highlight = 1.0 - smoothstep(1.1, 3.2, edge_distance);
	base = mix(base, vec3(0.43, 0.29, 0.16), highlight * state.r * 0.25);
	base = mix(base, vec3(0.53, 0.65, 0.39), highlight * state.g * 0.7);
	base = mix(base, vec3(0.70, 0.27, 0.15), highlight * state.b * 0.85);
	// Fine physical material grain, without baked shadows.
	float grain = dot(texture(ground_grain, UV * world_size / 110.0).rgb, vec3(0.299, 0.587, 0.114));
	base *= 1.0 + (grain - 0.5) * (land ? 0.19 : 0.03);
	ALBEDO = base * 0.9;
	ROUGHNESS = land ? 0.94 : 0.78;
	SPECULAR = land ? 0.12 : 0.24;
}
