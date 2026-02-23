(() => {
    if (!window.THREE) {
        return;
    }

    const mount = document.getElementById('spacetime-bg');
    if (!mount) {
        return;
    }

    const THREE = window.THREE;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;

    const FABRIC_WIDTH = 182;
    const FABRIC_HEIGHT = 124;
    const FABRIC_HALF_WIDTH = FABRIC_WIDTH * 0.5;
    const FABRIC_HALF_HEIGHT = FABRIC_HEIGHT * 0.5;
    const SEGMENTS_X = viewportWidth < 900 ? 86 : 118;
    const SEGMENTS_Y = viewportWidth < 900 ? 58 : 82;

    const MAX_STARS = 8;
    const EPSILON = 22;
    const RECOVERY_RATE = 0.12;
    const CURSOR_MASS_TARGET = 30;
    const LENSING_STRENGTH = viewportWidth < 900 ? 24 : 34;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050913, 0.0125);

    const camera = new THREE.PerspectiveCamera(44, viewportWidth / viewportHeight, 0.1, 500);
    camera.position.set(0, -78, 72);
    camera.lookAt(0, 0, -6);

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
    } catch (err) {
        return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(viewportWidth, viewportHeight);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xb8d0ff, 0.38);
    const keyLight = new THREE.PointLight(0x8ea8ff, 1.2, 320, 2);
    keyLight.position.set(0, -25, 90);
    scene.add(ambient, keyLight);

    const fabricGeometry = new THREE.PlaneGeometry(FABRIC_WIDTH, FABRIC_HEIGHT, SEGMENTS_X, SEGMENTS_Y);
    const vertexCount = fabricGeometry.attributes.position.count;
    const fabricPositions = fabricGeometry.attributes.position.array;
    const fabricBasePositions = new Float32Array(fabricPositions.length);
    fabricBasePositions.set(fabricPositions);

    const displacementCurrent = new Float32Array(vertexCount);

    const fabricFill = new THREE.Mesh(
        fabricGeometry,
        new THREE.MeshBasicMaterial({
            color: 0x0d1d33,
            transparent: true,
            opacity: 0.36,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );

    const fabricWire = new THREE.Mesh(
        fabricGeometry,
        new THREE.MeshBasicMaterial({
            color: 0x86aefb,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        })
    );

    fabricFill.position.z = -0.4;
    fabricWire.position.z = -0.35;

    scene.add(fabricFill, fabricWire);

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    const hitPoint = new THREE.Vector3();
    const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    function mapScreenToFabric(clientX, clientY, out) {
        pointerNDC.set((clientX / viewportWidth) * 2 - 1, -(clientY / viewportHeight) * 2 + 1);
        raycaster.setFromCamera(pointerNDC, camera);

        if (!raycaster.ray.intersectPlane(interactionPlane, hitPoint)) {
            return false;
        }

        out.set(
            THREE.MathUtils.clamp(hitPoint.x, -FABRIC_HALF_WIDTH + 1.4, FABRIC_HALF_WIDTH - 1.4),
            THREE.MathUtils.clamp(hitPoint.y, -FABRIC_HALF_HEIGHT + 1.4, FABRIC_HALF_HEIGHT - 1.4)
        );

        return true;
    }

    function createGlowTexture() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.25, 'rgba(196,224,255,0.92)');
        gradient.addColorStop(0.6, 'rgba(120,170,255,0.35)');
        gradient.addColorStop(1, 'rgba(120,170,255,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    const glowTexture = createGlowTexture();

    function createMassRing(color) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(1.5, 1.72, 72),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.22,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        ring.position.z = 0.8;
        scene.add(ring);
        return ring;
    }

    function createMassCore(color) {
        const core = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: glowTexture,
                color,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        core.position.z = 1.4;
        core.scale.set(1.2, 1.2, 1);
        scene.add(core);
        return core;
    }

    const persistentMasses = [];

    const cursorMass = {
        position: new THREE.Vector2(0, 0),
        target: new THREE.Vector2(0, 0),
        strength: 0,
        targetStrength: 0,
        phase: Math.random() * Math.PI * 2,
        ring: createMassRing(0x95c0ff),
        core: createMassCore(0xcfe4ff)
    };

    cursorMass.ring.material.opacity = 0.14;
    cursorMass.core.material.opacity = 0.0;

    function disposeMassVisuals(mass) {
        scene.remove(mass.ring, mass.core);
        mass.ring.geometry.dispose();
        mass.ring.material.dispose();
        mass.core.material.dispose();
    }

    function addPersistentMass(x, y) {
        const strength = THREE.MathUtils.randFloat(18, 30);
        const mass = {
            position: new THREE.Vector2(x, y),
            strength,
            currentStrength: 0,
            targetStrength: strength,
            phase: Math.random() * Math.PI * 2,
            ring: createMassRing(0xaec7ff),
            core: createMassCore(0xf5f9ff)
        };

        persistentMasses.push(mass);

        if (persistentMasses.length > MAX_STARS) {
            const oldest = persistentMasses.shift();
            disposeMassVisuals(oldest);
        }
    }

    function releaseCursorMass() {
        cursorMass.targetStrength = 0;
    }

    const pointerBuffer = new THREE.Vector2();

    window.addEventListener('pointermove', (event) => {
        if (mapScreenToFabric(event.clientX, event.clientY, pointerBuffer)) {
            cursorMass.target.copy(pointerBuffer);
            cursorMass.targetStrength = CURSOR_MASS_TARGET;
        }
    }, { passive: true });

    window.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
            return;
        }

        if (!mapScreenToFabric(event.clientX, event.clientY, pointerBuffer)) {
            return;
        }

        addPersistentMass(pointerBuffer.x, pointerBuffer.y);
    }, { passive: true });

    window.addEventListener('blur', releaseCursorMass);
    document.addEventListener('mouseleave', releaseCursorMass);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            releaseCursorMass();
        }
    });

    const backgroundStarCount = viewportWidth < 900 ? 170 : 280;
    const starBasePositions = new Float32Array(backgroundStarCount * 3);
    const starPositions = new Float32Array(backgroundStarCount * 3);
    const starPhase = new Float32Array(backgroundStarCount);

    for (let i = 0; i < backgroundStarCount; i += 1) {
        const i3 = i * 3;
        const x = THREE.MathUtils.randFloatSpread(FABRIC_WIDTH * 1.35);
        const y = THREE.MathUtils.randFloatSpread(FABRIC_HEIGHT * 1.35);
        const z = THREE.MathUtils.randFloat(18, 42);

        starBasePositions[i3] = x;
        starBasePositions[i3 + 1] = y;
        starBasePositions[i3 + 2] = z;

        starPositions[i3] = x;
        starPositions[i3 + 1] = y;
        starPositions[i3 + 2] = z;

        starPhase[i] = Math.random() * Math.PI * 2;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMaterial = new THREE.PointsMaterial({
        color: 0xd4e3ff,
        size: viewportWidth < 900 ? 0.75 : 0.95,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    function applyMassContribution(sampleX, sampleY, massX, massY, strength) {
        const dx = sampleX - massX;
        const dy = sampleY - massY;
        return -strength / Math.sqrt(dx * dx + dy * dy + EPSILON);
    }

    function applyLensing(sampleX, sampleY, massX, massY, strength, out) {
        const dx = sampleX - massX;
        const dy = sampleY - massY;
        const r2 = dx * dx + dy * dy + 48;
        const r = Math.sqrt(r2);

        const radialShift = (LENSING_STRENGTH * strength) / (r2 * (r + 1));
        const shearShift = (strength / (r2 + 120)) * 0.025;

        out.x += -dx * radialShift - dy * shearShift;
        out.y += -dy * radialShift + dx * shearShift;
    }

    function updateMassVisual(mass, strength, time, isCursor) {
        const safeStrength = Math.max(strength, 0);
        const schwarzschildRadius = Math.max(1.05, 0.86 * Math.sqrt(safeStrength + 0.2));
        const twinkle = 1 + Math.sin(time * 0.0012 + mass.phase) * 0.05;

        mass.ring.position.set(mass.position.x, mass.position.y, 0.82);
        mass.ring.scale.set(schwarzschildRadius, schwarzschildRadius, 1);
        mass.ring.material.opacity = isCursor
            ? 0.08 + Math.min(0.15, safeStrength * 0.0055)
            : 0.12 + Math.min(0.2, safeStrength * 0.0045);

        const coreScale = (isCursor ? 1.1 : 0.95) + Math.sqrt(safeStrength + 0.01) * 0.07;
        mass.core.position.set(mass.position.x, mass.position.y, 1.4);
        mass.core.scale.set(coreScale * twinkle, coreScale * twinkle, 1);
        mass.core.material.opacity = Math.min(isCursor ? 0.42 : 0.62, safeStrength * 0.022);
    }

    const lensingVector = new THREE.Vector2();
    let lastFrameTime = 0;

    function animate(time) {
        requestAnimationFrame(animate);

        if (prefersReducedMotion && time - lastFrameTime < 34) {
            return;
        }

        lastFrameTime = time;

        cursorMass.position.lerp(cursorMass.target, 0.16);
        cursorMass.strength += (cursorMass.targetStrength - cursorMass.strength) * 0.085;

        for (let i = 0; i < persistentMasses.length; i += 1) {
            const mass = persistentMasses[i];
            mass.currentStrength += (mass.targetStrength - mass.currentStrength) * 0.08;
            updateMassVisual(mass, mass.currentStrength, time, false);
        }

        updateMassVisual(cursorMass, cursorMass.strength, time, true);

        for (let i = 0; i < vertexCount; i += 1) {
            const i3 = i * 3;
            const px = fabricBasePositions[i3];
            const py = fabricBasePositions[i3 + 1];

            let zTarget = 0;

            for (let m = 0; m < persistentMasses.length; m += 1) {
                const mass = persistentMasses[m];
                if (mass.currentStrength > 0.02) {
                    zTarget += applyMassContribution(px, py, mass.position.x, mass.position.y, mass.currentStrength);
                }
            }

            if (cursorMass.strength > 0.02) {
                zTarget += applyMassContribution(px, py, cursorMass.position.x, cursorMass.position.y, cursorMass.strength);
            }

            displacementCurrent[i] += (zTarget - displacementCurrent[i]) * RECOVERY_RATE;
            fabricPositions[i3 + 2] = fabricBasePositions[i3 + 2] + displacementCurrent[i];
        }

        fabricGeometry.attributes.position.needsUpdate = true;

        for (let i = 0; i < backgroundStarCount; i += 1) {
            const i3 = i * 3;
            const baseX = starBasePositions[i3];
            const baseY = starBasePositions[i3 + 1];
            const baseZ = starBasePositions[i3 + 2];

            lensingVector.set(0, 0);

            for (let m = 0; m < persistentMasses.length; m += 1) {
                const mass = persistentMasses[m];
                if (mass.currentStrength > 0.03) {
                    applyLensing(baseX, baseY, mass.position.x, mass.position.y, mass.currentStrength, lensingVector);
                }
            }

            if (cursorMass.strength > 0.03) {
                applyLensing(baseX, baseY, cursorMass.position.x, cursorMass.position.y, cursorMass.strength, lensingVector);
            }

            starPositions[i3] += (baseX + lensingVector.x - starPositions[i3]) * 0.16;
            starPositions[i3 + 1] += (baseY + lensingVector.y - starPositions[i3 + 1]) * 0.16;
            starPositions[i3 + 2] = baseZ + Math.sin(time * 0.001 + starPhase[i]) * 0.12;
        }

        starGeometry.attributes.position.needsUpdate = true;
        starMaterial.opacity = 0.56 + 0.06 * Math.sin(time * 0.0008);

        renderer.render(scene, camera);
    }

    function handleResize() {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;

        camera.aspect = viewportWidth / viewportHeight;
        camera.updateProjectionMatrix();

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        renderer.setSize(viewportWidth, viewportHeight);
    }

    window.addEventListener('resize', handleResize, { passive: true });

    animate(0);
})();
