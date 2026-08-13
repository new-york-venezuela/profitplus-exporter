# SP: pConsultarCambios
**Tipo**: Consultar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saPista`](../tables/saPista.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: [pConsultarCambios]
DESCRIPCION	: Consultar los costos para un Tipo de Documento
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 13/03/2025
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pConsultarCambios]
AS 
    BEGIN

        SELECT distinct
        te.name AS eventtype
       ,t.starttime
       ,t.loginname
       ,t.hostname
       ,t.ntusername
       ,t.ntdomainname
       ,t.applicationname
       --,t.spid
       ,t.objectname
       ,t.databasename
	   --,T.TextData
FROM sys.fn_trace_gettable
(
    CONVERT (VARCHAR(150) ,( SELECT TOP 1 value FROM sys.fn_trace_getinfo(NULL)  WHERE property = 2)),DEFAULT
) T 
INNER JOIN sys.trace_events as te ON t.eventclass = te.trace_event_id 
where ObjectName in ('saPista','TrigDelete_saFacturaVenta','TrigDelete_saPista','saFacturaventa','TrigDelete_saNotaEntregaVenta','saNotaEntregaVenta')
and t.databasename = DB_NAME()
order by t.starttime desc
END
```
