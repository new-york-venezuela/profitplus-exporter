# SP: pv_InsertarFactura
**Tipo**: PV-Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saPista`](../tables/saPista.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pv_InsertarFactura
*DESCRIPCIÓN	: SE INSERTA UN NUEVO REGISTRO EN LA TABLA saFacturaVenta Y saDocumentoVenta 
				  AL MOMENTO DE INICIAR UNA FACTURA DESDE PUNTO DE VENTA 
*CREATE DATE    : 2011-12-12
*LASTUPDATE DATE: 2020-07-27				  
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_InsertarFactura]
(            
      @sFactNum         CHAR(30), 
      @sNroControl		VARCHAR(20) = NULL,
      @bContrib         BIT, 
      @sCoCli           CHAR(16), 
      @sCo_Cta_Ingr_Egr CHAR(20) = NULL,
      @sCoVen           CHAR(6), 
      @sCoTran          CHAR(6), 
      @sTasa            DECIMAL (21, 8), 
      @sMoneda          CHAR(6), 
      @sCo_us_in        CHAR(6), 
      @sCo_sucu         CHAR(6), 
      @tsValidador		TIMESTAMP,
      @sCoCond          CHAR(6) , 
	  @sMaquina		VARCHAR(60)			=	NULL  -- KDC Inf para saPista
)
AS
BEGIN
       DECLARE @fecha SMALLDATETIME
       SET @fecha = GETDATE()
        
             
              EXEC pInsertarfacturaVenta  @sFactNum, 'FACTURA CREADA DESDE PUNTO DE VENTA', @sCoCli, @sCoTran, @sMoneda, @sCo_Cta_Ingr_Egr, @sCoVen,
                                          @sCoCond, @fecha, @fecha, @fecha, 'False', '0',     @sTasa, @sNroControl, NULL, 0, NULL, 0, 0, 0, 0, 0, 0, 0,
                                          0, 0, 0, NULL, NULL, NULL, @bContrib, 'False', NULL, NULL, NULL, NULL, 'False', NULL, NULL, NULL, NULL, NULL, NULL,
                                          NULL, NULL, @sCo_us_in, @sCo_sucu, NULL, NULL, @sMaquina  
                    
              EXEC pInsertarDocumentoVenta 'FACT',@sFactNum, @sCoCli,@sCoVen, @sMoneda,NULL,@sCo_Cta_Ingr_Egr,@sTasa,'FACTURA CREADA DESDE PUNTO DE VENTA',
                           @fecha, @fecha, @fecha,'False','True', 'False','FACT', @sFactNum, NULL, 0, 0, 0, 0, NULL,NULL, 0, 0, 0, 0, NULL,
                           NULL, 0, 0, 0, NULL, @sNroControl, NULL, 0, 0, 0, 0, 0, 0, 0, NULL, 'False', NULL, NULL, NULL, 0, 0, 0,
                           NULL, NULL, NULL, NULL, NULL, NULL, NULL,NULL,'1',NULL,@sCo_sucu,@sCo_us_in, @sMaquina
             
             SELECT @sFactNum AS Numero
END
```
