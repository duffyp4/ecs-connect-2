import { webhookService } from '../server/services/webhook';

const mockPickupXML = `<?xml version="1.0" encoding="UTF-8"?>
<submission-notification>
  <form>
    <id>5640587</id>
    <name>Pickup Log</name>
    <guid>abc123</guid>
  </form>
  <submission>
    <id>12345678</id>
    <guid>sub-guid-123</guid>
  </submission>
  <dispatch-item>
    <id>dispatch-123</id>
  </dispatch-item>
</submission-notification>`;

const mockEmissionsXML = `<?xml version="1.0" encoding="UTF-8"?>
<submission-notification>
  <form>
    <id>5654184</id>
    <name>Emissions Service Log</name>
    <guid>form-guid-456</guid>
  </form>
  <submission>
    <id>87654321</id>
    <guid>sub-guid-456</guid>
  </submission>
</submission-notification>`;

const mockDeliveryXML = `<?xml version="1.0" encoding="UTF-8"?>
<submission-notification>
  <form>
    <id>5657146</id>
    <name>Delivery Log</name>
    <guid>form-guid-789</guid>
  </form>
  <submission>
    <id>99887766</id>
    <guid>sub-guid-789</guid>
  </submission>
</submission-notification>`;

async function testPushNotificationParsing() {
  console.log('\n🧪 ===== TESTING WEBHOOK XML PARSING =====\n');
  
  try {
    console.log('Test 1: Parsing Pickup Log notification');
    console.log('XML:', mockPickupXML);
    await webhookService.processGoCanvasWebhook(
      mockPickupXML, 
      'application/xml'
    );
    console.log('✅ Pickup notification parsed successfully\n');
  } catch (error) {
    console.error('❌ Pickup notification parsing failed:', error);
  }

  try {
    console.log('\nTest 2: Parsing Emissions Service Log notification');
    console.log('XML:', mockEmissionsXML);
    await webhookService.processGoCanvasWebhook(
      mockEmissionsXML, 
      'application/xml'
    );
    console.log('✅ Emissions notification parsed successfully\n');
  } catch (error) {
    console.error('❌ Emissions notification parsing failed:', error);
  }

  try {
    console.log('\nTest 3: Parsing Delivery Log notification');
    console.log('XML:', mockDeliveryXML);
    await webhookService.processGoCanvasWebhook(
      mockDeliveryXML, 
      'application/xml'
    );
    console.log('✅ Delivery notification parsed successfully\n');
  } catch (error) {
    console.error('❌ Delivery notification parsing failed:', error);
  }

  try {
    console.log('\nTest 4: Idempotency - sending duplicate notification');
    await webhookService.processGoCanvasWebhook(
      mockPickupXML, 
      'application/xml'
    );
    console.log('✅ Duplicate notification handled (should be ignored)\n');
  } catch (error) {
    console.error('❌ Idempotency test failed:', error);
  }

  console.log('\n===== TEST COMPLETE =====\n');
  
  const { webhookMetrics } = await import('../server/services/webhook');
  console.log('📊 Final Metrics:', JSON.stringify(webhookMetrics, null, 2));
}

testPushNotificationParsing()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
