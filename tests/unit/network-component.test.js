/* global assert, process, setup, suite, test */
var aframe = require('aframe');
var helpers = require('./helpers.js');
var naf = require('../../src/NafIndex.js');

require('../../src/components/network-component.js');

suite('network-component', function() {
  var scene;
  var entity;
  var netComp;

  function initScene(done) {
    var opts = {};
    opts.entity = '<a-entity id="test-entity" network="networkId:network1;owner:owner1;components:position,rotation" position="1 2 3" rotation="4 3 2 1;" template="src:#template1;"></a-entity>';
    scene = helpers.sceneFactory(opts);
    naf.util.whenEntityLoaded(scene, done);
  }

  setup(function(done) {
    initScene(function() {
      entity = document.querySelector('#test-entity');
      netComp = entity.components['network'];
      done();
    });
  });

  teardown(function() {
    scene.parentElement.removeChild(scene);
  });

  suite('Setup', function() {

    test('creates entity', function() {
      assert.isNotNull(entity);
    });
  });

  suite('init', function() {
    test('syncs when mine', sinon.test(function() {
      this.stub(netComp, 'isMine').returns(true);
      this.stub(netComp, 'syncAll');

      netComp.init();

      assert.isTrue(netComp.syncAll.calledOnce);
    }));

    test('does not sync when not mine', sinon.test(function() {
      naf.connection.isMineAndConnected = this.stub().returns(false);
      this.stub(netComp, 'syncAll');

      netComp.init();

      assert.isFalse(netComp.syncAll.called);
    }));
  });

  suite('update', function() {

    test('binds events', sinon.test(function() {
      this.spy(netComp, 'bindEvents');

      netComp.update();

      assert.isTrue(netComp.bindEvents.called);
    }));
  });

  suite('bindEvents', function() {

    test('adds event listeners when mine', sinon.test(function() {
      naf.connection.isMineAndConnected = this.stub().returns(true);
      naf.connection.broadcastData = this.stub();
      this.spy(entity, 'addEventListener');
      this.spy(entity, 'removeEventListener');

      netComp.bindEvents();

      assert.isTrue(entity.addEventListener.calledWith('sync'));
      assert.isTrue(entity.addEventListener.calledWith('syncAll'));
      assert.isTrue(entity.addEventListener.calledWith('networkUpdate'));
      assert.isTrue(entity.addEventListener.calledThrice);
      assert.isFalse(entity.removeEventListener.called);

      naf.connection.isMineAndConnected = this.stub().returns(false);
    }));

    test('adds & removes event listeners when not mine', sinon.test(function() {
      naf.connection.isMineAndConnected = this.stub().returns(false);
      naf.connection.broadcastData = this.stub();
      this.spy(entity, 'addEventListener');
      this.spy(entity, 'removeEventListener');

      netComp.bindEvents();

      assert.isFalse(entity.addEventListener.calledWith('sync'));
      assert.isFalse(entity.addEventListener.calledWith('syncAll'));
      assert.isTrue(entity.addEventListener.calledWith('networkUpdate'));
      assert.isTrue(entity.addEventListener.calledOnce);
      assert.isTrue(entity.removeEventListener.calledWith('sync'));
    }));
  });

  suite('tick', function() {

    test('syncs when mine and needsToSync', sinon.test(function() {
      naf.connection.isMineAndConnected = this.stub().returns(true);
      this.stub(netComp, 'needsToSync').returns(true);
      this.stub(netComp, 'syncDirty');

      netComp.tick();

      assert.isTrue(netComp.syncDirty.calledOnce);

      naf.connection.isMineAndConnected = this.stub().returns(false);
    }));

    test('does not sync when not mine', sinon.test(function() {
      naf.connection.isMineAndConnected = this.stub().returns(false);
      this.stub(netComp, 'needsToSync').returns(true);
      this.stub(netComp, 'syncDirty');

      netComp.tick();

      assert.isFalse(netComp.syncDirty.called);
    }));

    test('does not sync when not needsToSync', sinon.test(function() {
      naf.connection.isMineAndConnected = this.stub().returns(true);
      this.stub(netComp, 'needsToSync').returns(false);
      this.stub(netComp, 'syncDirty');

      netComp.tick();

      assert.isFalse(netComp.syncDirty.called);

      naf.connection.isMineAndConnected = this.stub().returns(false);
    }));
  });

  suite('needsToSync', function() {

    test('next sync time equals current time', sinon.test(function() {
      this.stub(naf.util, 'now').returns(5);
      netComp.nextSyncTime = 5;

      var result = netComp.needsToSync();

      assert.isTrue(result);
    }));

    test('next sync time just under current time', sinon.test(function() {
      this.stub(naf.util, 'now').returns(5);
      netComp.nextSyncTime = 4.9;

      var result = netComp.needsToSync();

      assert.isTrue(result);
    }));

    test('next sync time just over current time', sinon.test(function() {
      this.stub(naf.util, 'now').returns(5);
      netComp.nextSyncTime = 5.1;

      var result = netComp.needsToSync();

      assert.isFalse(result);
    }));
  });

  suite('isMine', function() {

    test('calls naf.connection.isMine', sinon.test(function() {
      naf.connection.isMineAndConnected = this.stub();

      netComp.isMine();

      assert.isTrue(naf.connection.isMineAndConnected.calledWith('owner1'));
    }));

    test('true when owner is mine', sinon.test(function() {
      naf.connection.isMineAndConnected = this.stub().returns(true);

      var result = netComp.isMine();

      assert.isTrue(result);

      naf.connection.isMineAndConnected = this.stub().returns(false);
    }));

    test('false when owner is not mine', sinon.test(function() {
      naf.connection.isMineAndConnected = this.stub().returns(false);

      var result = netComp.isMine();

      assert.isFalse(result);
    }));
  });

  suite('syncAll', function() {

    test('broadcasts uncompressed data', sinon.test(function() {
      naf.connection.broadcastDataGuaranteed = this.stub();
      var oldData = {
        position: { x: 1, y: 2, z: 5 /* changed */ },
        rotation: { x: 4, y: 2 /* changed */, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;
      var newComponents = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };
      var entityData = {
        0: 0,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: newComponents
      };

      netComp.syncAll();

      var called = naf.connection.broadcastDataGuaranteed.calledWithExactly('s', entityData);
      assert.isTrue(called);
    }));

    test('sets next sync time', sinon.test(function() {
      naf.connection.broadcastDataGuaranteed = this.stub();
      this.spy(netComp, 'updateNextSyncTime');

      netComp.syncAll();

      assert.isTrue(netComp.updateNextSyncTime.calledOnce);
    }));

    test('updates cache', sinon.test(function() {
      var oldData = {
        position: { x: 1, y: 2, z: 5 /* changed */ },
        rotation: { x: 4, y: 2 /* changed */, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;
      naf.connection.broadcastDataGuaranteed = this.stub();
      this.spy(netComp, 'updateCache');

      netComp.syncAll();

      assert.isTrue(netComp.updateCache.calledOnce);
    }));
  });

  suite('syncDirty', function() {

    test('broadcasts uncompressed data', sinon.test(function() {
      naf.connection.broadcastData = this.stub();
      naf.globals.compressSyncPackets = false;
      var oldData = {
        position: { x: 1, y: 2, z: 5 /* changed */ },
        rotation: { x: 4, y: 2 /* changed */, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;
      var newComponents = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };
      var entityData = {
        0: 0,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: newComponents
      };

      netComp.syncDirty();

      var called = naf.connection.broadcastData.calledWithExactly('s', entityData);
      assert.isTrue(called);
    }));

    test('broadcasts compressed data', sinon.test(function() {
      naf.connection.broadcastData = this.stub();
      naf.globals.compressSyncPackets = true;
      var oldData = {
        position: { x: 1, y: 2, z: 5 /* changed */ },
        rotation: { x: 4, y: 2 /* changed */, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;
      var newComponents = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };
      var entityData = {
        0: 1,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: newComponents
      };
      var compressed = netComp.compressSyncData(entityData);

      netComp.syncDirty();

      var called = naf.connection.broadcastData.calledWithExactly('s', compressed);
      assert.isTrue(called);
    }));

    test('sets next sync time', sinon.test(function() {
      var oldData = {
        position: { x: 1, y: 2, z: 5 /* changed */ },
        rotation: { x: 4, y: 2 /* changed */, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;
      naf.connection.broadcastData = this.stub();
      this.spy(netComp, 'updateNextSyncTime');

      netComp.syncDirty();

      assert.isTrue(netComp.updateNextSyncTime.calledOnce);
    }));

    test('updates cache', sinon.test(function() {
      var oldData = {
        position: { x: 1, y: 2, z: 5 /* changed */ },
        rotation: { x: 4, y: 2 /* changed */, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;
      naf.connection.broadcastData = this.stub();
      this.spy(netComp, 'updateCache');

      netComp.syncDirty();

      assert.isTrue(netComp.updateCache.calledOnce);
    }));

    test('returns early if no dirty components', sinon.test(function() {
      naf.connection.broadcastData = this.stub();
      this.spy(netComp, 'updateCache');
      this.spy(netComp, 'updateNextSyncTime');
      var oldData = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;

      netComp.syncDirty();

      assert.isTrue(netComp.updateNextSyncTime.calledOnce);
      assert.isFalse(naf.connection.broadcastData.called);
      assert.isFalse(netComp.updateCache.calledOnce);
    }));
  });

  suite('getDirtyComponents', function() {

    test('creates correct dirty list with one element', sinon.test(function() {
      var oldData = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 2 /* changed */, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;

      var result = netComp.getDirtyComponents();

      assert.deepEqual(result, ['rotation']);
    }));

    test('creates correct dirty list with two elements', sinon.test(function() {
      var oldData = {
        position: { x: 1, y: 2, z: 5 /* changed */ },
        rotation: { x: 4, y: 2 /* changed */, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;

      var result = netComp.getDirtyComponents();

      assert.deepEqual(result, ['position', 'rotation']);
    }));

    test('creates correct dirty list when one component is not cached', sinon.test(function() {
      var oldData = {
        position: { x: 1, y: 2, z: 5 /* changed */ },
      };
      netComp.cachedData = oldData;

      var result = netComp.getDirtyComponents();

      assert.deepEqual(result, ['position', 'rotation']);
    }));

    test('adds no components to dirty list', sinon.test(function() {
      var oldData = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;

      var result = netComp.getDirtyComponents();

      assert.deepEqual(result, []);
    }));
  });

  suite('createSyncData', function() {

    test('creates correct data', sinon.test(function() {
      var components = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };
      var entityData = {
        0: 0,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: components
      };

      var result = netComp.createSyncData(components);

      assert.deepEqual(result, entityData);
    }));
  });

  suite('compressSyncData', function() {

    test('example packet', function() {
      var components = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };
      var entityData = {
        0: 1,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: components
      };
      var compressed = [
        1,
        entityData.networkId,
        entityData.owner,
        entityData.template,
        {
          0: components.position,
          1: components.rotation
        }
      ];

      var result = netComp.compressSyncData(entityData);

      assert.deepEqual(result, compressed);
    });

    test('example packet with non-sequential components', function() {
      netComp.data.components.push('scale');
      var components = {
        position: { x: 1, y: 2, z: 3 },
        scale: { x: 10, y: 11, z: 12 }
      };
      var entityData = {
        0: 1,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: components
      };
      var compressed = [
        1,
        entityData.networkId,
        entityData.owner,
        entityData.template,
        {
          0: components.position,
          2: components.scale
        }
      ];

      var result = netComp.compressSyncData(entityData);

      assert.deepEqual(result, compressed);
    });

    test('example packet with no components', function() {
      var entityData = {
        0: 1,
        networkId: 'network1',
        owner: 'owner1',
        template: '#template1',
        components: {}
      };
      var compressed = [
        1,
        entityData.networkId,
        entityData.owner,
        entityData.template,
        {}
      ];

      var result = netComp.compressSyncData(entityData);

      assert.deepEqual(result, compressed);
    });
  });

  suite('decompressSyncData', function() {

    test('example packet', function() {
      var components = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };
      var entityData = {
        0: 1,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: components
      };
      var compressed = [
        1,
        entityData.networkId,
        entityData.owner,
        entityData.template,
        {
          0: components.position,
          1: components.rotation
        }
      ];

      var result = netComp.decompressSyncData(compressed);

      assert.deepEqual(result, entityData);
    });

    test('example packet with non-sequential components', function() {
      netComp.data.components.push('scale');
      var components = {
        position: { x: 1, y: 2, z: 3 },
        scale: { x: 10, y: 11, z: 12 }
      };
      var entityData = {
        0: 1,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: components
      };
      var compressed = [
        1,
        entityData.networkId,
        entityData.owner,
        entityData.template,
        {
          0: components.position,
          2: components.scale
        }
      ];

      var result = netComp.decompressSyncData(compressed);

      assert.deepEqual(result, entityData);
    });

    test('example packet with no components', function() {
      var entityData = {
        0: 1,
        networkId: 'network1',
        owner: 'owner1',
        template: '#template1',
        components: {}
      };
      var compressed = [
        1,
        entityData.networkId,
        entityData.owner,
        entityData.template,
        {}
      ];

      var result = netComp.decompressSyncData(compressed);

      assert.deepEqual(result, entityData);
    });
  });

  suite('getComponentsData', function() {

    test('collects correct data', function() {
      var compData = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };

      var result = netComp.getComponentsData(['position', 'rotation']);

      assert.deepEqual(result, compData);
    });
  });

  suite('updateCache', function() {

    test('resets dirty components field', function() {
      var oldData = {
        position: { x: 1, y: 2, z: 5 /* changed */ },
        rotation: { x: 4, y: 2 /* changed */, z: 2, w: 1 }
      };
      netComp.cachedData = oldData;
      var newComponents = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 3, z: 2, w: 1 }
      };

      netComp.updateCache(newComponents);

      assert.deepEqual(netComp.cachedData, newComponents);
    });
  });

  suite('updateNextSyncTime', function() {

    test('sets nextSyncTime correctly', sinon.test(function() {
      this.stub(naf.util, 'now').returns(5000);
      naf.globals.updateRate = 1;

      netComp.updateNextSyncTime();

      assert.approximately(netComp.nextSyncTime, 6000, 0.00001);
    }));
  });

  suite('networkUpdate', function() {

    test('sets correct uncompressed data', sinon.test(function() {
      var entityData = {
        0: 0,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: {
          position: { x: 10, y: 20, z: 30 },
          rotation: { x: 40, y: 30, z: 20, w: 10 },
          scale: { x: 5, y: 12, z: 1 },
          visible: false
        }
      }

      netComp.networkUpdate({ detail: { entityData: entityData } });

      var components = entity.components;
      assert.equal(components['position'].data.x, 10, 'Position');
      assert.equal(components['position'].data.y, 20, 'Position');
      assert.equal(components['position'].data.z, 30, 'Position');

      assert.equal(components['rotation'].data.x, 40, 'Rotation');
      assert.equal(components['rotation'].data.y, 30, 'Rotation');
      assert.equal(components['rotation'].data.z, 20, 'Rotation');
      assert.equal(components['rotation'].data.w, 10, 'Rotation');

      assert.equal(components['scale'].data.x, 1, 'Scale');
      assert.equal(components['scale'].data.y, 1, 'Scale');
      assert.equal(components['scale'].data.z, 1, 'Scale');

      assert.equal(components['visible'].data, true, 'Visible');
    }));

    test('sets correct compressed data', sinon.test(function() {
      var entityData = {
        0: 1,
        networkId: 'network1',
        owner: 'owner1',
        template: '',
        components: {
          position: { x: 10, y: 20, z: 30 },
          rotation: { x: 40, y: 30, z: 20, w: 10 },
          scale: { x: 5, y: 12, z: 1 },
          visible: false
        }
      };
      var compressed = [
        1,
        'network1',
        'owner1',
        '',
        {
          0: { x: 10, y: 20, z: 30 },
          1: { x: 40, y: 30, z: 20, w: 10 }
        }
      ];

      netComp.networkUpdate({ detail: { entityData: compressed } });

      var components = entity.components;
      assert.equal(components['position'].data.x, 10, 'Position');
      assert.equal(components['position'].data.y, 20, 'Position');
      assert.equal(components['position'].data.z, 30, 'Position');

      assert.equal(components['rotation'].data.x, 40, 'Rotation');
      assert.equal(components['rotation'].data.y, 30, 'Rotation');
      assert.equal(components['rotation'].data.z, 20, 'Rotation');
      assert.equal(components['rotation'].data.w, 10, 'Rotation');

      assert.equal(components['scale'].data.x, 1, 'Scale');
      assert.equal(components['scale'].data.y, 1, 'Scale');
      assert.equal(components['scale'].data.z, 1, 'Scale');

      assert.equal(components['visible'].data, true, 'Visible');
    }));
  });

  suite('remove', function() {

    test('when mine broadcasts removal', sinon.test(function() {
      naf.connection.broadcastData = this.stub();
      naf.connection.isMineAndConnected = this.stub().returns(true);

      netComp.remove();

      var data = { networkId: 'network1' }
      assert.isTrue(naf.connection.broadcastData.calledWith('r', data));

      naf.connection.isMineAndConnected = this.stub().returns(false);
    }));

    test('when not mine does not broadcast removal', sinon.test(function() {
      naf.connection.broadcastData = this.stub();
      naf.connection.isMineAndConnected = this.stub().returns(false);

      netComp.remove();

      assert.isFalse(naf.connection.broadcastData.called);
    }));
  });
});