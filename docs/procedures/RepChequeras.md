# SP: RepChequeras
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <06/09/2010>
-- Description:	<Chequeras>
-- =============================================
CREATE PROCEDURE [RepChequeras]
	-- Add the parameters for the stored procedure here
    @sCo_cta_d CHAR(6) = NULL ,
    @sCo_cta_h CHAR(6) = NULL ,
    @sCo_co_chra_d CHAR(6) = NULL ,
    @sCo_co_chra_h CHAR(6) = NULL ,
    @sStatus CHAR(4) = NULL ,
    @sCo_Inactivo CHAR(4) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Sucu CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

    -- Insert statements for procedure here

/****Valores por defecto****/

		
        IF ( @sCo_Inactivo = 'TODO' ) 
            SET @sCo_Inactivo = NULL		

        IF ( @sCo_Inactivo = 'SIT' ) 
            SET @sCo_Inactivo = 1
	
        IF ( @sCo_Inactivo = 'NOT' ) 
            SET @sCo_Inactivo = 0	
				
/****Valores por defecto****/

        DECLARE @CheqDis TABLE
            (
              [dis] [int] ,
              [co_chra] [char](6)
            )
	 
        INSERT  INTO @CheqDis
                SELECT
                    *
                FROM
                    ( SELECT
                        COUNT(*) AS dis, Che.co_chra AS co_chra
                      FROM
                        saChequera Che
                        INNER JOIN saCheque ch ON Che.co_chra = Ch.co_chra
                      WHERE
                        Ch.status = 'Dis'
                      GROUP BY
                        Che.co_chra
                    ) A  
			
			

        DECLARE @CheqNum TABLE
            (
              [co_chra] [char](6) ,
              [min_cheq_tot] [char](20) ,
              [max_cheq_tot] [char](20)
            )
     
        INSERT  INTO @CheqNum
                SELECT
                    *
                FROM
                    ( SELECT
                        Che.co_chra AS co_chra, MIN(co_cheq) AS min_cheq_tot, MAX(co_cheq) AS max_cheq_tot
                      FROM
                        saChequera Che
                        INNER JOIN saCheque ch ON Che.co_chra = Ch.co_chra
                      GROUP BY
                        Che.co_chra
                    ) B  

        DECLARE @temp TABLE
            (
              [co_chra] [char](6) ,
```
