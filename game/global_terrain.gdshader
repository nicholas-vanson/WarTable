shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_disabled;

uniform sampler2D height_map : filter_linear, repeat_disable;
uniform sampler2D geography : source_color, filter_linear, repeat_disable;
uniform sampler2D territories : filter_nearest, repeat_disable;
uniform sampler2D control_palette : source_color, filter_nearest, repeat_disable;
uniform vec2 world_size = vec2(7705.0, 3213.0);
uniform vec2 raster_size = vec2(2048.0, 854.0);
uniform float relief_height = 75.0;

float altitude(vec2 p) { return textureLod(height_map, p, 0.0).r * relief_height; }

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
	// Transparent at the territory center; strongest just inside its boundary.
	float wash = pow(1.0 - smoothstep(0.0, 0.68, territory.b), 1.35) * 0.43 * owner.a;
	base = mix(base, owner.rgb, wash);
	float edge_distance = territory.a * 16.0;
	float border = 1.0 - smoothstep(0.7, 1.65, edge_distance);
	bool land = texture(height_map, UV).r > 0.002;
	// Crisp vector outlines are projected from the authoritative polygons above
	// this surface, rather than enlarged from this lower-resolution ID raster.
	float highlight = 1.0 - smoothstep(1.1, 3.2, edge_distance);
	base = mix(base, vec3(0.95, 0.77, 0.42), highlight * state.r * 0.8);
	base = mix(base, vec3(0.53, 0.65, 0.39), highlight * state.g * 0.7);
	base = mix(base, vec3(0.70, 0.27, 0.15), highlight * state.b * 0.85);
	// Very fine contour printing follows the elevation, without baked shadows.
	float elevation = texture(height_map, UV).r;
	float contour = 1.0 - smoothstep(0.025, 0.09, abs(fract(elevation * 48.0) - 0.5));
	base *= 1.0 - contour * 0.055 * float(land);
	ALBEDO = base;
	ROUGHNESS = land ? 0.94 : 0.78;
	SPECULAR = land ? 0.12 : 0.24;
}
