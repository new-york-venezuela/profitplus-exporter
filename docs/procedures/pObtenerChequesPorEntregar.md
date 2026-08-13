# SP: pObtenerChequesPorEntregar
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saCheque`](../tables/saCheque.md)
- [`saChequeDevueltoCompra`](../tables/saChequeDevueltoCompra.md)
- [`saChequera`](../tables/saChequera.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =========================================================================
-- Autor:		SOFTECH SISTEMAS
-- Creado:      <24-11-2009>
-- Modificado:  SOFTECH SISTEMAS <23-07-2010>
-- Descripcion:	<Obtiene los cheques disponibles por entregar al proveedor  
--				 luego de haberse realizado el proceso de pago>
-- =========================================================================
CREATE PROCEDURE [dbo].[pObtenerChequesPorEntregar]
    @tipo INT ,               --Proveedor =0, Beneficiario =1, Todos = 2
    @status INT ,             --Por Entregar = 0, Entregados= 1
    @fechaDesde DATETIME = NULL ,    --Fecha a partir la consulta de los cheques entregados  
    @Prov_Bene VARCHAR(100) = NULL --Proveedor o Beneficiario a consultar
AS 
    BEGIN

        SET NOCOUNT ON ;

        DECLARE @num_doc CHAR(20)
        DECLARE @cod_cta CHAR(6)
        DECLARE @cob_num CHAR(20)
        DECLARE @ord_num CHAR(20)
        DECLARE @monto DECIMAL(18, 5)
        DECLARE @prov_benef VARCHAR(100)
        DECLARE @fecha_entrega DATETIME
        DECLARE @co_chra CHAR(6)
        DECLARE @tsValidador TIMESTAMP
        DECLARE @fec_ent DATETIME
        DECLARE @entreg_a CHAR(60)
        DECLARE @comentario VARCHAR(MAX)
		DECLARE @tsrowguid VARCHAR(MAX)

                                        
        CREATE TABLE #tblresultAdicional
            (
              Co_Cheq CHAR(20) ,
              doc_pago CHAR(20) ,
              num_doc CHAR(20) ,
              Monto DECIMAL(18, 5) ,
              prov_ben VARCHAR(100) ,
              Fecha DATETIME ,
              co_chra CHAR(6) ,
              Validador VARBINARY(MAX),
              fec_ent DATETIME,
              entreg_a CHAR(60),
              comentario VARCHAR(MAX),
			  rowguid VARCHAR(100)
            ) 
        IF @fechaDesde IS NOT NULL 
            SET @fechaDesde = dbo.FechaSimple(@fechaDesde)

--PROVEEDOR y POR ENTREGAR                                  
        IF ( @tipo = 0
             OR @tipo = 2
           )
            AND @status = 0 
            BEGIN                                     
                                         
  --Creacion del Cursor que contiene todos los cheques ubicados en orden de pago para realizar
  --el recorrido entre cada uno de ellos y verificar si no han sido entregados 
                    
                DECLARE tabla_cursor_cheques CURSOR
                FOR
                    SELECT
```
