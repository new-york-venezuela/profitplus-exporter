# SP: pInsertarRenglonesArtIdentificador
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtIdentificadorReng`](../tables/saArtIdentificadorReng.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pInsertarRenglonesIdentificador
DESCRIPCION:	
AUTOR:			SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesArtIdentificador]
    (
      @sCo_Art CHAR(30) ,
      @iReng_Num INT ,
      @sCo_Iden CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @sDes_Uni CHAR(60) = NULL ,
      @sDes_Iden VARCHAR(60) ,
      @deCantidad DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
	
        IF EXISTS ( SELECT  *
                    FROM    dbo.saArticulo
                    WHERE   @sCo_Iden = co_art ) 
            BEGIN
		
                DECLARE @MensajeError VARCHAR(256)              
                SET @MensajeError = 'El renglón ' + RTRIM(LTRIM(STR(@iReng_Num)))
                    + ' posee un identificador que ya corresponde a un artículo.'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END
	
	
        INSERT  INTO saArtIdentificadorReng
                ( co_art ,
                  reng_num ,
                  co_iden ,
                  co_uni ,
                  des_iden ,
                  cantidad ,
                  co_us_in ,
                  co_sucu_in ,
                  fe_us_in ,
                  co_us_mo ,
                  co_sucu_mo ,
                  fe_us_mo ,
                  trasnfe ,
                  revisado 
                )
        OUTPUT  inserted.fe_us_in ,
                inserted.fe_us_mo ,
                Inserted.rowguid
                INTO @TableTimestamp
        VALUES  ( @sCo_Art ,
                  @iReng_Num ,
                  @sCo_Iden ,
                  @sCo_Uni ,
                  @sDes_Iden ,
                  @deCantidad ,
                  @sCo_Us_In ,
                  @sCo_Sucu_In ,
                  GETDATE() ,
                  @sCo_Us_In ,
                  @sCo_Sucu_In ,
                  GETDATE() ,
                  @sTrasnfe ,
                  @sRevisado
```
